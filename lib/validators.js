const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function validateRegisterInput(data) {
  const errors = {};
  const firstName = (data.firstName || '').trim();
  const lastName = (data.lastName || '').trim();
  const email = (data.email || '').trim().toLowerCase();
  const password = data.password || '';
  const gender = (data.gender || '').trim();
  const birthDateRaw = (data.birthDate || '').trim();

  if (firstName.length < 2 || firstName.length > 50) {
    errors.firstName = 'Le prenom doit contenir entre 2 et 50 caracteres';
  }
  if (lastName.length < 2 || lastName.length > 50) {
    errors.lastName = 'Le nom doit contenir entre 2 et 50 caracteres';
  }
  if (!EMAIL_REGEX.test(email)) {
    errors.email = 'Adresse email invalide';
  }
  if (password.length < 8) {
    errors.password = 'Le mot de passe doit contenir au moins 8 caracteres';
  }
  if (gender !== 'male' && gender !== 'female') {
    errors.gender = 'Merci de preciser le sexe';
  }

  let birthDate = null;
  if (birthDateRaw) {
    if (!DATE_REGEX.test(birthDateRaw) || Number.isNaN(new Date(birthDateRaw).getTime())) {
      errors.birthDate = 'Date de naissance invalide';
    } else if (new Date(birthDateRaw) > new Date()) {
      errors.birthDate = 'La date de naissance ne peut pas etre dans le futur';
    } else {
      birthDate = birthDateRaw;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    data: { firstName, lastName, email, password, gender, birthDate }
  };
}

export function validateLoginInput(data) {
  const errors = {};
  const email = (data.email || '').trim().toLowerCase();
  const password = data.password || '';

  if (!EMAIL_REGEX.test(email)) {
    errors.email = 'Adresse email invalide';
  }
  if (!password) {
    errors.password = 'Le mot de passe est requis';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    data: { email, password }
  };
}

export function validateForgotPasswordInput(data) {
  const errors = {};
  const email = (data.email || '').toString().trim().toLowerCase();

  if (!EMAIL_REGEX.test(email)) {
    errors.email = 'Adresse email invalide';
  }

  return { isValid: Object.keys(errors).length === 0, errors, data: { email } };
}

export function validateResetPasswordInput(data) {
  const errors = {};
  const email = (data.email || '').toString().trim().toLowerCase();
  const code = (data.code || '').toString().replace(/\s+/g, '');
  const password = (data.password || '').toString();

  if (!EMAIL_REGEX.test(email)) {
    errors.email = 'Adresse email invalide';
  }
  if (!/^\d{6}$/.test(code)) {
    errors.code = 'Le code doit contenir 6 chiffres';
  }
  if (password.length < 8) {
    errors.password = 'Le mot de passe doit contenir au moins 8 caracteres';
  }

  return { isValid: Object.keys(errors).length === 0, errors, data: { email, code, password } };
}
