import { TRPCError } from "@trpc/server";
import { collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where, setDoc, orderBy, limit } from "firebase/firestore";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { db } from "../../firebase";

export const assetsRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const assetsRef = collection(db, "assets");
      const q = input?.projectId 
        ? query(assetsRef, where("projectId", "==", input.projectId))
        : query(assetsRef, orderBy("createdAt", "desc"));
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startDate: data.startDate?.toDate ? data.startDate.toDate().toISOString() : data.startDate,
          endDate: data.endDate?.toDate ? data.endDate.toDate().toISOString() : data.endDate,
          availabilityDate: data.availabilityDate?.toDate ? data.availabilityDate.toDate().toISOString() : data.availabilityDate,
        };
      });
    }),

  listByProject: protectedProcedure
    .input(z.object({ projectId: z.coerce.string() }))
    .query(async ({ input }) => {
      const assetsRef = collection(db, "assets");
      const q = query(assetsRef, where("projectId", "==", input.projectId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startDate: data.startDate?.toDate ? data.startDate.toDate().toISOString() : data.startDate,
          endDate: data.endDate?.toDate ? data.endDate.toDate().toISOString() : data.endDate,
          availabilityDate: data.availabilityDate?.toDate ? data.availabilityDate.toDate().toISOString() : data.availabilityDate,
        };
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.coerce.string() }))
    .query(async ({ input }) => {
      const docRef = doc(db, "assets", input.id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new TRPCError({ code: "NOT_FOUND", message: "Ativo não encontrado" });
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        startDate: data.startDate?.toDate ? data.startDate.toDate().toISOString() : data.startDate,
        endDate: data.endDate?.toDate ? data.endDate.toDate().toISOString() : data.endDate,
        availabilityDate: data.availabilityDate?.toDate ? data.availabilityDate.toDate().toISOString() : data.availabilityDate,
      };
    }),

  getNextNumber: protectedProcedure.query(async () => {
    const assetsRef = collection(db, "assets");
    
    // 1. Tenta buscar o último ativo com o prefixo ATV-
    const qPrefix = query(
      assetsRef, 
      where("assetNumber", ">=", "ATV-"), 
      where("assetNumber", "<=", "ATV-\uf8ff"), 
      orderBy("assetNumber", "desc"), 
      limit(1)
    );
    const snapPrefix = await getDocs(qPrefix);

    let lastNumber = 0;

    if (!snapPrefix.empty) {
      const lastCode = snapPrefix.docs[0].data().assetNumber;
      const matches = lastCode.match(/(\d+)$/);
      if (matches) {
        lastNumber = Number(matches[0]);
      }
    } else {
      // 2. Fallback: Se não achar ATV-, busca o maior número puro (do padrão anterior) para continuar a sequência
      const qNum = query(assetsRef, where("assetNumber", "<", "A"), orderBy("assetNumber", "desc"), limit(1));
      const snapNum = await getDocs(qNum);
      
      if (!snapNum.empty) {
        const lastCode = snapNum.docs[0].data().assetNumber;
        if (!isNaN(Number(lastCode))) {
          lastNumber = Number(lastCode);
        }
      }
    }

    const next = lastNumber + 1;
    return `ATV-${String(next).padStart(6, "0")}`;
  }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.coerce.string(),
        assetNumber: z.string().optional(),
        name: z.string(),
        description: z.string().optional(),
        tagNumber: z.string().optional(),
        value: z.string().optional(),
        startDate: z.string().or(z.date()).optional(),
        endDate: z.string().or(z.date()).optional(),
        notes: z.string().optional(),
        accountingAccount: z.string().optional(),
        assetClass: z.string().optional(),
        usefulLife: z.string().or(z.number()).optional(),
        corporateUsefulLife: z.number().optional(),
        depreciationAccountCode: z.string().optional(),
        amortizationAccountCode: z.string().optional(),
        resultAccountCode: z.string().optional(),
        costCenter: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = Date.now().toString();
      await setDoc(doc(db, "assets", id), {
        ...input,
        assetNumber: input.assetNumber ?? null,
        description: input.description ?? null,
        tagNumber: input.tagNumber ?? null,
        value: input.value ?? null,
        notes: input.notes ?? null,
        accountingAccount: input.accountingAccount ?? null,
        assetClass: input.assetClass ?? null,
        usefulLife: input.usefulLife ?? null,
        corporateUsefulLife: input.corporateUsefulLife ?? null,
        depreciationAccountCode: input.depreciationAccountCode ?? null,
        amortizationAccountCode: input.amortizationAccountCode ?? null,
        resultAccountCode: input.resultAccountCode ?? null,
        costCenter: input.costCenter ?? null,
        status: "planejamento",
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.coerce.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["planejamento", "em_desenvolvimento", "concluido", "parado"]).optional(),
        tagNumber: z.string().optional(),
        value: z.string().optional(),
        startDate: z.string().or(z.date()).optional(),
        endDate: z.string().or(z.date()).optional(),
        notes: z.string().optional(),
        accountingAccount: z.string().optional(),
        assetClass: z.string().optional(),
        usefulLife: z.string().or(z.number()).optional(),
        corporateUsefulLife: z.number().optional(),
        depreciationAccountCode: z.string().optional(),
        amortizationAccountCode: z.string().optional(),
        resultAccountCode: z.string().optional(),
        availabilityDate: z.string().or(z.date()).optional(),
        residualValue: z.string().or(z.number()).optional(),
        hasImpairment: z.boolean().optional(),
        costCenter: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const updateData: any = { ...data, updatedAt: new Date() };
      if (data.startDate) updateData.startDate = new Date(data.startDate);
      if (data.endDate) updateData.endDate = new Date(data.endDate);
      if (data.availabilityDate) updateData.availabilityDate = new Date(data.availabilityDate);
      if (data.availabilityDate) updateData.availabilityDate = new Date(data.availabilityDate);

      // Remove undefined keys to prevent Firestore error
      Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

      const docRef = doc(db, "assets", id);
      await updateDoc(docRef, updateData);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.coerce.string() }))
    .mutation(async ({ input }) => {
            await deleteDoc(doc(db, "assets", input.id));
            return { success: true };
          }),
      
        getBudgetedValues: protectedProcedure
          .input(z.object({ projectId: z.string().optional() }))
          .query(async ({ input }) => {
            // 1. Fetch all assets and budgets for the project
            const assetsRef = collection(db, "assets");
            const assetsQuery = input?.projectId 
              ? query(assetsRef, where("projectId", "==", input.projectId))
              : query(assetsRef);
            const assetsSnap = await getDocs(assetsQuery);
            const assets = assetsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
            const budgetsRef = collection(db, "budgets");
            const budgetsQuery = input?.projectId
              ? query(budgetsRef, where("projectId", "==", input.projectId))
              : query(budgetsRef);
            const budgetsSnap = await getDocs(budgetsQuery);
            const budgets = budgetsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
            if (budgets.length === 0) return {};
      
            // 2. Create a map of budgetId -> assetId
            const budgetToAssetMap = new Map<string, string>();
            const assetBudgets: any[] = [];
            assets.forEach(asset => {
              const foundBudget = budgets.find(b => 
                b.name.includes(asset.name) ||
                (asset.assetNumber && b.name.includes(asset.assetNumber)) ||
                (b.description && b.description.includes(asset.name)) ||
                (asset.assetNumber && b.description && b.description.includes(asset.assetNumber))
              );
              if (foundBudget) {
                budgetToAssetMap.set(foundBudget.id, asset.id);
                assetBudgets.push(foundBudget);
              }
            });
      
            const assetBudgetIds = assetBudgets.map(b => b.id);
            if (assetBudgetIds.length === 0) return {};
      
            // 3. Fetch all budget items for the found budgets
            const itemsRef = collection(db, "budgetItems");
            const allItems: any[] = [];
            const idChunks: string[][] = [];
      
            for (let i = 0; i < assetBudgetIds.length; i += 30) {
              idChunks.push(assetBudgetIds.slice(i, i + 30));
            }
      
            for (const chunk of idChunks) {
              const qItems = query(itemsRef, where("budgetId", "in", chunk));
              const itemsSnap = await getDocs(qItems);
              itemsSnap.forEach(doc => {
                allItems.push({ id: doc.id, ...doc.data() });
              });
            }
      
            // 4. Calculate totals for each budget
            const budgetTotals = new Map<string, number>();
            allItems.forEach(item => {
              const total = budgetTotals.get(item.budgetId) || 0;
              budgetTotals.set(item.budgetId, total + parseFloat(item.amount || "0"));
            });
      
            // 5. Map budget totals back to asset IDs
            const assetTotals: Record<string, number> = {};
            budgetTotals.forEach((total, budgetId) => {
              const assetId = budgetToAssetMap.get(budgetId);
              if (assetId) {
                assetTotals[assetId] = total;
              }
            });
      
            return assetTotals;
          }),
      });
      