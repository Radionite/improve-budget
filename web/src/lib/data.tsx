import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection, doc, onSnapshot, orderBy, query, updateDoc, type DocumentData, type QueryConstraint,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Household } from './types';

type Ctx = {
  user: User | null;
  loading: boolean;
  household: Household | null;
  hid: string | null;
  update: (patch: Partial<Household> | Record<string, unknown>) => Promise<void>;
};

const DataContext = createContext<Ctx>({ user: null, loading: true, household: null, hid: null, update: async () => {} });

export function DataProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [hid, setHid] = useState<string | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    if (!u) { setHid(null); setHousehold(null); setLoading(false); }
  }), []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    return onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const id = (snap.data()?.householdId as string | undefined) ?? null;
      setHid(id);
      if (!id) { setHousehold(null); setLoading(false); }
    }, () => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!hid) return;
    return onSnapshot(doc(db, 'households', hid), (snap) => {
      setHousehold(snap.exists() ? ({ id: snap.id, ...snap.data() } as Household) : null);
      setLoading(false);
    }, () => setLoading(false));
  }, [hid]);

  const update = async (patch: Record<string, unknown>) => {
    if (hid) await updateDoc(doc(db, 'households', hid), patch);
  };

  return <DataContext.Provider value={{ user, loading, household, hid, update }}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);

/** Live lijst van een subcollectie van het huishouden. */
export function useCollection<T extends { id: string }>(name: string, ...constraints: QueryConstraint[]) {
  const { hid } = useData();
  const [items, setItems] = useState<T[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!hid) return;
    const q = query(collection(db, 'households', hid, name), ...constraints);
    return onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) }) as T));
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hid, name]);
  return { items, ready };
}

export const byDateDesc = orderBy('date', 'desc');
export const col = (hid: string, name: string) => collection(db, 'households', hid, name);
export const docRef = (hid: string, name: string, id: string) => doc(db, 'households', hid, name, id);
