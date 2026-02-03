import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { ENV } from './_core/env';

export type User = {
  openId: string;
  email: string | null;
  name: string | null;
  loginMethod: string | null;
  role: "user" | "admin" | "classificador" | "engenheiro" | "diretor";
  lastSignedIn: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export async function upsertUser(user: Partial<User> & { openId: string }): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const userRef = doc(db, "users", user.openId);
  const snap = await getDoc(userRef);
  const now = new Date();

  let role = user.role;
  if (!role && user.openId === ENV.ownerOpenId) {
    role = 'admin';
  }

  const userData: any = {
    ...user,
    lastSignedIn: user.lastSignedIn ?? now,
    updatedAt: now,
  };

  // Remove undefined fields
  Object.keys(userData).forEach(key => userData[key] === undefined && delete userData[key]);

  if (!snap.exists()) {
    await setDoc(userRef, {
      ...userData,
      role: role ?? "user",
      createdAt: now,
    });
  } else {
    await updateDoc(userRef, userData);
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const userRef = doc(db, "users", openId);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    const data = snap.data();
    return {
      openId: data.openId,
      email: data.email ?? null,
      name: data.name ?? null,
      loginMethod: data.loginMethod ?? null,
      role: data.role ?? "user",
      lastSignedIn: data.lastSignedIn?.toDate ? data.lastSignedIn.toDate() : (data.lastSignedIn ?? null),
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ?? undefined),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ?? undefined),
    };
  }
  return undefined;
}
