import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { error } from "node:console";


const KEY_LENGTH = 64;
const HASH_ALGORITHM = "scrypt";

function deriveKey(password: string ,salt:string):Promise <Buffer>{
    return new Promise((resolve ,reject)=>{
        scrypt(password , salt , KEY_LENGTH , (error ,deriveKey)=>{
            if(error) {
                reject(error);
                return;
            }

            resolve(deriveKey);
        })
    })
}

export async function hashPassword(password:string) : Promise <string> {
    const salt = randomBytes(16).toString("base64url");
    const derivedKey = await deriveKey(password ,salt);
    
    return `${HASH_ALGORITHM}$${salt}$${derivedKey.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [algorithm, salt, encodedHash] = storedHash.split("$");

  if (
    algorithm !== HASH_ALGORITHM ||
    !salt ||
    !encodedHash ||
    storedHash.split("$").length !== 3
  ) {
    return false;
  }

  const storedKey = Buffer.from(encodedHash, "base64");

  if (storedKey.length !== KEY_LENGTH) {
    return false;
  }

  const derivedKey = await deriveKey(password, salt);

  return timingSafeEqual(storedKey, derivedKey);
}