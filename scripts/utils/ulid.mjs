const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford's Base32
const ENCODING_LEN = ENCODING.length;
const TIME_MAX = Math.pow(2, 48) - 1;
const RANDOM_LEN = 16;

// Encode a number to a base32 string
function encodeBase32(number, length) {
  let str = '';
  while (length > 0) {
    str = ENCODING[number % ENCODING_LEN] + str;
    number = Math.floor(number / ENCODING_LEN);
    length--;
  }
  return str;
}

// Hash a string using the Web Crypto API
async function hashStringToBytes(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

// Generate a custom identifier based on a string
async function generateCustomUlid(input) {
  const time = Date.now();
  if (time > TIME_MAX) {
    throw new Error('Time exceeds maximum value');
  }

  const timeStr = encodeBase32(time, 10);
  const hashBytes = await hashStringToBytes(input);
  let randomStr = '';
  for (let i = 0; i < RANDOM_LEN; i++) {
    randomStr += ENCODING[hashBytes[i] % ENCODING_LEN];
  }

  return timeStr + randomStr;
}

// Export the function for use in Foundry VTT
export { generateCustomUlid };
