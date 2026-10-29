const EVENT_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const isValidEventEmail = (email) =>
  typeof email === 'string' && EVENT_EMAIL_REGEX.test(email.trim());

export const isValidEventPhone = (phone) => {
  if (typeof phone !== 'string') return false;
  const value = phone.trim();
  if (!value) return true;
  const digitCount = (value.match(/\d/g) || []).length;
  return /^\+?[\d\s().-]+$/.test(value) && digitCount >= 7 && digitCount <= 15;
};

export const isValidEventUrl = (value, instagramOnly = false) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    const url = new URL(trimmed);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !!url.hostname &&
      !url.username &&
      !url.password &&
      (!instagramOnly ||
        url.hostname === 'instagram.com' ||
        url.hostname.endsWith('.instagram.com'))
    );
  } catch {
    return false;
  }
};

export const getSafeWhatsAppGroupUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' &&
      url.hostname === 'chat.whatsapp.com' &&
    !url.port &&
    !url.username &&
      !url.password &&
      url.pathname.length > 1
      ? url.toString()
      : '';
  } catch {
    return '';
  }
};

export const getRegisteredWhatsAppGroupUrl = (registration, response) => {
  if (!registration || registration.status !== 'registered') return '';
  return getSafeWhatsAppGroupUrl(response?.data?.whatsappGroupUrl);
};

export const getEventContacts = (event = {}) =>
  Array.isArray(event.contacts)
    ? event.contacts
        .filter((contact) =>
          contact &&
          typeof contact === 'object' &&
          !Array.isArray(contact) &&
          typeof contact.name === 'string' &&
          contact.name.trim() &&
          isValidEventEmail(contact.email)
        )
        .map(({ name, role, email, phone }) => ({
          name: name.trim(),
          role: typeof role === 'string' ? role.trim() : '',
          email: email.trim().toLowerCase(),
          phone: typeof phone === 'string' ? phone.trim() : ''
        }))
    : [];

export const getOfficialEventLinks = (event = {}) => {
  const links = [];
  if (typeof event.websiteUrl === 'string' && isValidEventUrl(event.websiteUrl)) {
    const url = event.websiteUrl.trim();
    if (url) links.push({ type: 'website', label: 'Website', href: url });
  }
  if (
    typeof event.instagramUrl === 'string' &&
    isValidEventUrl(event.instagramUrl, true)
  ) {
    const url = event.instagramUrl.trim();
    if (url) links.push({ type: 'instagram', label: 'Instagram', href: url });
  }
  return links;
};
