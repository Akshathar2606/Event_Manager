const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User } = require('../src/models/User');
const connectDB = require('../src/config/db');
const { EMAIL_REGEX } = require('../src/utils/validation');

const BOOTSTRAP_STATE_ID = 'initial-administrator-created';
const DEFAULT_ADMIN_NAME = 'EventFlow Administrator';
const MAX_TRANSACTION_ATTEMPTS = 3;

const bootstrapStateSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    createdAt: { type: Date, required: true, default: Date.now }
  },
  { collection: 'eventflow_bootstrap_state', versionKey: false }
);

const BootstrapState =
  mongoose.models.EventFlowBootstrapState ||
  mongoose.model('EventFlowBootstrapState', bootstrapStateSchema);

class BootstrapError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BootstrapError';
    this.code = code;
  }
}

const validateBootstrapInput = ({ name, email, password } = {}) => {
  const normalizedName =
    typeof name === 'string' && name.trim() ? name.trim() : DEFAULT_ADMIN_NAME;
  if (normalizedName.length < 2 || normalizedName.length > 100) {
    throw new BootstrapError('INVALID_NAME', 'Administrator name must be between 2 and 100 characters.');
  }

  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    throw new BootstrapError('INVALID_EMAIL', 'A valid administrator email is required.');
  }

  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    Buffer.byteLength(password, 'utf8') > 72 ||
    !/[A-Za-z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    throw new BootstrapError(
      'INVALID_PASSWORD',
      'Administrator password must be 8–72 UTF-8 bytes and contain at least one letter and one number.'
    );
  }

  return {
    name: normalizedName,
    email: email.trim().toLowerCase(),
    password
  };
};

const isRetryableTransactionError = (error) =>
  Boolean(
    (error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError')) ||
      error.code === 112 ||
      (error.message && error.message.includes('WriteConflict'))
  );

const createInitialAdmin = async ({
  input,
  UserModel = User,
  BootstrapStateModel = BootstrapState,
  startSession = () => mongoose.startSession(),
  hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }
}) => {
  const credentials = validateBootstrapInput(input);
  const session = await startSession();

  try {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      session.startTransaction();

      try {
        await BootstrapStateModel.create(
          [{ _id: BOOTSTRAP_STATE_ID, createdAt: new Date() }],
          { session }
        );

        const activeAdministrator = await UserModel.findOne({
          role: 'administrator',
          isActive: true
        }).session(session);
        if (activeAdministrator) {
          throw new BootstrapError(
            'ACTIVE_ADMIN_EXISTS',
            'An active administrator already exists; bootstrap was not performed.'
          );
        }

        const existingEmail = await UserModel.findOne({
          email: credentials.email
        }).session(session);
        if (existingEmail) {
          throw new BootstrapError(
            'DUPLICATE_EMAIL',
            'That email is already registered; bootstrap was not performed.'
          );
        }

        const passwordHash = await hashPassword(credentials.password);
        await UserModel.create(
          [
            {
              name: credentials.name,
              email: credentials.email,
              passwordHash,
              role: 'administrator',
              isActive: true
            }
          ],
          { session }
        );

        await session.commitTransaction();
        return;
      } catch (error) {
        try {
          await session.abortTransaction();
        } catch (abortError) {
          // MongoDB may have already aborted the transaction.
        }

        if (error instanceof BootstrapError) {
          throw error;
        }
        if (error.code === 11000) {
          throw new BootstrapError(
            'BOOTSTRAP_ALREADY_USED',
            'Administrator bootstrap has already been completed or the email is already registered.'
          );
        }
        if (isRetryableTransactionError(error) && attempt < MAX_TRANSACTION_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 50));
          continue;
        }
        throw new BootstrapError(
          'DATABASE_OPERATION_FAILED',
          'Administrator bootstrap could not be completed. Check database connectivity and try again.'
        );
      }
    }

    throw new BootstrapError(
      'TRANSACTION_RETRIES_EXHAUSTED',
      'Administrator bootstrap could not be serialized. Please try again.'
    );
  } finally {
    await session.endSession();
  }
};

const hasTransactionSupport = () => {
  const client = mongoose.connection.client;
  return Boolean(
    client &&
      client.topology &&
      (client.topology.description.type === 'ReplicaSetWithPrimary' ||
        client.topology.description.type === 'Sharded')
  );
};

const run = async () => {
  try {
    const input = {
      name: process.env.ADMIN_NAME,
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD
    };
    validateBootstrapInput(input);
    await connectDB();

    if (!hasTransactionSupport()) {
      throw new BootstrapError(
        'TRANSACTIONS_UNAVAILABLE',
        'Administrator bootstrap requires a replica set or sharded MongoDB deployment.'
      );
    }

    await createInitialAdmin({ input });
    console.log('Initial administrator account created successfully.');
  } catch (error) {
    console.error(
      error instanceof BootstrapError
        ? error.message
        : 'Administrator bootstrap failed. Check database connectivity and server configuration.'
    );
    process.exitCode = 1;
  } finally {
    delete process.env.ADMIN_NAME;
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
};

if (require.main === module) {
  run();
}

module.exports = {
  BootstrapError,
  createInitialAdmin,
  validateBootstrapInput
};
