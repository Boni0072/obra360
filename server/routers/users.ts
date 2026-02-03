import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { firebaseAdmin } from "../_core/firebaseAdmin";
import { protectedProcedure, router } from "../_core/trpc";
import { db as clientDb } from "../../firebase";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

export const usersRouter = router({
  list: protectedProcedure.query(async () => {
    try {
      // 1. Tenta via Admin SDK (Privilegiado)
      if (firebaseAdmin.apps.length > 0) {
        try {
          const authUsers = await firebaseAdmin.auth().listUsers(1000);
          const db = firebaseAdmin.firestore();
          const userDocs = await db.collection("users").get();

          const users = authUsers.users.map((user) => {
            const userDoc = userDocs.docs.find((d) => d.id === user.uid);
            const userData = userDoc ? userDoc.data() : {};

            return {
              id: user.uid,
              email: user.email || "",
              name: user.displayName || (userData.name as string) || "Sem Nome",
              role: (userData.role as string) || "user",
              allowedPages: (userData.allowedPages as string[]) || [],
              createdAt: user.metadata.creationTime,
            };
          });

          return users;
        } catch (e) {
          console.warn("[Users] Falha no Admin SDK, tentando Client SDK...", e);
        }
      }

      // 2. Fallback: Client SDK (Funciona em Dev se as regras permitirem)
      const snapshot = await getDocs(collection(clientDb, "users"));
      const users = snapshot.docs.map((doc) => {
        const data = doc.data();
        
        let createdAt: string | undefined;
        if (data.createdAt && typeof data.createdAt.toDate === 'function') {
          createdAt = data.createdAt.toDate().toISOString();
        } else if (data.createdAt) {
          // Se for qualquer outra coisa (string, etc), tenta passar direto
          createdAt = data.createdAt;
        }

        return {
          id: doc.id,
          email: data.email,
          name: data.name,
          role: data.role,
          allowedPages: data.allowedPages,
          createdAt,
        };
      });

      return users;
    } catch (error) {
      console.error("Erro ao listar usuários:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Erro ao listar usuários",
      });
    }
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        email: z.string().email(),
        password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
        role: z.string(),
        allowedPages: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      console.log(`[Users] Tentando criar usuário auth: ${input.email}`);
      try {
        let uid: string;

        // Verifica se o Admin SDK está pronto antes de tentar criar no Auth
        if (firebaseAdmin.apps.length === 0) {
          if (process.env.NODE_ENV === "development") {
            console.warn("⚠️ AVISO: Admin SDK não configurado. Gerando usuário APENAS no Firestore (sem login).");
            uid = `dev-${Date.now()}`;
          } else {
            throw new Error("Firebase Admin SDK não inicializado. Verifique as credenciais.");
          }
        } else {
          // 1. Criar usuário no Firebase Authentication (apenas se SDK estiver ok)
          const userRecord = await firebaseAdmin.auth().createUser({
            email: input.email,
            password: input.password,
            displayName: input.name,
          });
          uid = userRecord.uid;
          console.log(`[Users] Usuário criado no Auth com UID: ${uid}`);
        }

        // 2. Salvar metadados no Firestore usando o UID como ID do documento
        const dataToSave = {
          ...input,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        if (firebaseAdmin.apps.length > 0) {
          await firebaseAdmin.firestore().collection("users").doc(uid).set(dataToSave);
        } else {
          // Fallback para Client SDK
          await setDoc(doc(clientDb, "users", uid), dataToSave);
        }

        console.log(`[Users] Metadados do usuário salvos no Firestore! ID: ${uid}`);
        return { id: uid };
      } catch (error: any) {
        console.error("Erro ao criar usuário:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        // Códigos de erro comuns do Firebase Admin SDK
        if (error.code === 'auth/email-already-exists') {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Este e-mail já está em uso.",
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao criar usuário. Verifique os logs do servidor.",
        });
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        password: z.string().optional(),
        role: z.string().optional(),
        allowedPages: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { id, ...data } = input;
        const { password } = input;

        // Atualiza no Firebase Auth se necessário
        if (data.email || data.name || (password && password.length >= 6)) {
          if (firebaseAdmin.apps.length > 0) {
            await firebaseAdmin.auth().updateUser(id, {
              ...(data.email && { email: data.email }),
              ...(data.name && { displayName: data.name }),
              ...(password && password.length >= 6 && { password: password }),
            });
          } else if (process.env.NODE_ENV === "development") {
            console.warn("[Users] Admin SDK não inicializado. Pulando atualização do Auth.");
            if (password) {
              console.warn("⚠️ AVISO: A senha não será alterada via aplicação pois o Admin SDK não está configurado.");
            }
          }
        }
        
        // Atualiza no Firestore
        const updateData = Object.fromEntries(
          Object.entries(data).filter(([_, v]) => v !== undefined)
        );
        const finalUpdateData = { ...updateData, updatedAt: new Date() };

        if (firebaseAdmin.apps.length > 0) {
          const db = firebaseAdmin.firestore();
          await db.collection("users").doc(id).update(finalUpdateData);
        } else {
          // Fallback para Client SDK
          await updateDoc(doc(clientDb, "users", id), finalUpdateData);
        }

        return { success: true };
      } catch (error) {
        console.error("Erro ao atualizar usuário:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao atualizar usuário",
        });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      try {
        // 1. Deletar do Firebase Authentication
        if (firebaseAdmin.apps.length > 0) {
          await firebaseAdmin.auth().deleteUser(input.id);
          console.log(`[Users] Usuário deletado do Auth: ${input.id}`);
        } else if (process.env.NODE_ENV === "development") {
          console.warn("[Users] Admin SDK não inicializado. Pulando deleção do Auth.");
        }

        // 2. Deletar do Firestore
        if (firebaseAdmin.apps.length > 0) {
          await firebaseAdmin.firestore().collection("users").doc(input.id).delete();
        } else {
          await deleteDoc(doc(clientDb, "users", input.id));
        }

        console.log(`[Users] Usuário deletado do Firestore: ${input.id}`);

        return { success: true };
      } catch (error) {
        console.error("Erro ao deletar usuário:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao deletar usuário",
        });
      }
    }),
});