import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hashes a password using bcrypt.
 * @param password The plaintext password to hash.
 * @returns The hashed password.
 */
export const hashPassword = async (password: string): Promise<string> => {
    return await bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Verifies a password against a hash.
 * @param password The plaintext password.
 * @param hash The hashed password.
 * @returns True if the password matches the hash, false otherwise.
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
    try {
        return await bcrypt.compare(password, hash);
    } catch (error) {
        // If the hash is invalid (e.g. plaintext), compare will fail or throw.
        // In that case, we return false and let the caller handle plaintext fallback if needed.
        return false;
    }
};
