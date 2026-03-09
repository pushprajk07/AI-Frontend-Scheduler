// ========== Validation Helper Functions ==========

function validateEmail(email: string): void {
    if (!email || email.trim() === '') {
        throw new Error('Email is required');
    }

    // Basic email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
    }

    // Check length
    if (email.length > 255) {
        throw new Error('Email is too long');
    }
}

function validatePassword(password: string): void {
    const minPasswordLength = 8;
    const maxPasswordLength = 128;

    if (!password || password.trim() === '') {
        throw new Error('Password is required');
    }

    // Check minimum length
    if (password.length < minPasswordLength) {
        throw new Error(`Password must be at least ${minPasswordLength} characters long`);
    }

    // Check maximum length
    if (password.length > maxPasswordLength) {
        throw new Error(`Password must be less than ${maxPasswordLength} characters`);
    }

    // Check password strength (at least one letter and one number)
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasLetter || !hasNumber) {
        throw new Error('Password must contain at least one letter and one number');
    }

    // Optional: Check for common weak passwords
    const weakPasswords = ['password', '12345678', 'qwerty123', 'abc12345'];
    if (weakPasswords.includes(password.toLowerCase())) {
        throw new Error('Password is too weak. Please choose a stronger password');
    }
}

export function validateEmailPassword(email: string, password: string): void {
    validateEmail(email);
    validatePassword(password);
}
