const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const USER_ROLES = ['administrator', 'organizer', 'participant', 'vendor'];
const PUBLIC_ALLOWED_ROLES = ['participant', 'organizer', 'vendor'];

const socialLinkSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      trim: true,
      maxlength: [30, 'Social link label cannot exceed 30 characters']
    },
    url: {
      type: String,
      trim: true,
      maxlength: [2048, 'Social link URL cannot exceed 2048 characters']
    }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    firstName: {
      type: String,
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
      default: ''
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
      default: ''
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid email address'
      ]
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false // Never return passwordHash in default queries
    },
    passwordResetTokenHash: {
      type: String,
      select: false
    },
    passwordResetExpires: {
      type: Date,
      select: false
    },
    authVersion: {
      type: Number,
      default: 0,
      select: false
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: {
        values: USER_ROLES,
        message: '{VALUE} is not a valid role. Allowed roles: ' + USER_ROLES.join(', ')
      },
      default: 'participant'
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    organization: {
      type: String,
      trim: true,
      default: ''
    },
    location: {
      type: String,
      trim: true,
      maxlength: [120, 'Location cannot exceed 120 characters'],
      default: ''
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
      default: ''
    },
    interests: {
      type: [{ type: String, trim: true, maxlength: 40 }],
      default: []
    },
    socialLinks: {
      type: [socialLinkSchema],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.passwordResetTokenHash;
        delete ret.passwordResetExpires;
        delete ret.authVersion;
        return ret;
      }
    },
    toObject: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.passwordResetTokenHash;
        delete ret.passwordResetExpires;
        delete ret.authVersion;
        return ret;
      }
    }
  }
);

userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });

// Method to verify password candidate against stored passwordHash
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash) {
    throw new Error('passwordHash is required on user instance to compare password');
  }
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Method to return safe public profile representation
userSchema.methods.toSafeObject = function () {
  return {
    id: this._id ? this._id.toString() : this.id,
    name: this.name,
    firstName: this.firstName || '',
    lastName: this.lastName || '',
    email: this.email,
    role: this.role,
    phone: this.phone || '',
    organization: this.organization || '',
    location: this.location || '',
    bio: this.bio || '',
    interests: this.interests || [],
    socialLinks: this.socialLinks || [],
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

const User = mongoose.model('User', userSchema);

module.exports = {
  User,
  USER_ROLES,
  PUBLIC_ALLOWED_ROLES
};
