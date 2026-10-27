import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import {
  adjustStock,
  createAd,
  createExpense,
  createLoan,
  createProduct,
  createReceivable,
  createSale,
  deleteAd,
  deleteCustomer,
  deleteExpense,
  deleteLoan,
  deleteObjective,
  deleteProduct,
  deleteReceivable,
  deleteSale,
  getDashboard,
  getDollarRates,
  getProjections,
  listAds,
  listCustomers,
  listExpenses,
  listLoans,
  listObjectives,
  listProductPerformance,
  listProducts,
  listReceivables,
  listSales,
  payLoan,
  payReceivable,
  updateAd,
  updateCustomer,
  updateExpense,
  updateLoan,
  updateObjective,
  updateProduct,
  updateReceivable,
  updateSale,
} from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { clearSharedSession, createSharedSession, passwordMatches, setSharedSession } from "./_core/sharedAuth";
import { getMetaAdsSnapshot, syncMetaAds } from "./metaAds";

const saleItem = z.object({
  productId: z.number().int().positive().optional(),
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  unitCost: z.number().nonnegative().optional(),
  fromInventory: z.boolean().default(false),
  supplier: z.string().optional(),
});

const productInput = z.object({
  name: z.string().min(2),
  category: z.string().min(1),
  supplier: z.string().optional(),
  stock: z.number().int().nonnegative(),
  cost: z.number().nonnegative(),
  minStock: z.number().int().nonnegative().optional(),
});
const expenseInput = z.object({
  date: z.string(),
  category: z.string(),
  description: z.string().min(2),
  amount: z.number().nonnegative(),
  type: z.string().optional(),
  notes: z.string().optional(),
});
const loanInput = z.object({
  kind: z.enum(["loan", "payable_merch", "internal"]),
  counterparty: z.string().min(2),
  description: z.string().optional(),
  currency: z.string().default("USD"),
  interestRate: z.number().nonnegative().default(0),
  interestPeriod: z.enum(["monthly", "weekly"]).default("monthly"),
  principal: z.number().positive(),
  repaymentAmount: z.number().positive().optional(),
  installmentCount: z.number().int().positive().optional(),
  installmentAmount: z.number().positive().optional(),
  installmentPeriod: z.enum(["monthly", "weekly"]).default("weekly"),
  hasDueDate: z.boolean().default(true),
  paid: z.number().nonnegative().default(0),
  dueDate: z.string().optional(),
  startDate: z.string().optional(),
  notes: z.string().optional(),
});
const receivableInput = z.object({
  customerName: z.string().min(2),
  phone: z.string().optional(),
  description: z.string().optional(),
  principal: z.number().positive(),
  paid: z.number().nonnegative().default(0),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});
const adInput = z.object({
  date: z.string(),
  platform: z.string().min(1),
  campaign: z.string().min(2),
  amount: z.number().nonnegative(),
  notes: z.string().optional(),
});
const objectiveInput = z.object({
  month: z.string().min(2),
  targetOrders: z.number().int().nonnegative(),
  targetRevenue: z.number().nonnegative(),
  targetProfit: z.number().nonnegative(),
  targetNet: z.number().nonnegative(),
  notes: z.string().optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    sharedLogin: publicProcedure
      .input(z.object({ password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        if (!passwordMatches(input.password)) throw new Error("Contraseña incorrecta");
        setSharedSession(ctx.res, await createSharedSession());
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      clearSharedSession(ctx.res);
      return { success: true } as const;
    }),
  }),
  business: router({
    dashboard: protectedProcedure
      .input(
        z
          .object({ from: z.string().optional(), to: z.string().optional() })
          .optional()
      )
      .query(({ input }) => getDashboard(input?.from, input?.to)),
    projections: protectedProcedure
      .input(
        z
          .object({ growthPercent: z.number().min(-50).max(200).optional() })
          .optional()
      )
      .query(({ input }) => getProjections(input?.growthPercent ?? 15)),
    dollarRates: protectedProcedure.query(() => getDollarRates()),
    productPerformance: protectedProcedure.query(() =>
      listProductPerformance()
    ),
    products: protectedProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            category: z.string().optional(),
          })
          .optional()
      )
      .query(({ input }) => listProducts(input?.search, input?.category)),
    sales: protectedProcedure
      .input(
        z
          .object({ limit: z.number().int().positive().max(500).optional() })
          .optional()
      )
      .query(({ input }) => listSales(input?.limit)),
    customers: protectedProcedure.query(() => listCustomers()),
    expenses: protectedProcedure.query(() => listExpenses()),
    loans: protectedProcedure.query(() => listLoans()),
    ads: protectedProcedure.query(() => listAds()),
    metaAds: protectedProcedure.query(() => getMetaAdsSnapshot()),
    syncMetaAds: protectedProcedure.mutation(() => syncMetaAds()),
    objectives: protectedProcedure.query(() => listObjectives()),
    receivables: protectedProcedure.query(() => listReceivables()),
    createProduct: protectedProcedure
      .input(productInput)
      .mutation(({ input, ctx }) =>
        createProduct({ ...input, userId: ctx.user.id })
      ),
    updateProduct: protectedProcedure
      .input(productInput.extend({ id: z.number().int().positive() }))
      .mutation(({ input, ctx }) =>
        updateProduct(input.id, { ...input, userId: ctx.user.id })
      ),
    deleteProduct: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input, ctx }) => deleteProduct(input.id, ctx.user.id)),
    adjustStock: protectedProcedure
      .input(
        z.object({
          productId: z.number().int().positive(),
          quantity: z.number().int(),
          type: z.enum(["purchase", "adjustment", "return"]),
          unitCost: z.number().nonnegative().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        adjustStock({ ...input, userId: ctx.user.id })
      ),
    createSale: protectedProcedure
      .input(
        z.object({
          date: z.string(),
          channel: z.string().optional(),
          customerName: z.string().optional(),
          customerPhone: z.string().optional(),
          customerId: z.number().int().positive().optional(),
          paymentStatus: z.enum(["paid", "partial"]).default("paid"),
          paidAmount: z.number().nonnegative().optional(),
          notes: z.string().optional(),
          items: z.array(saleItem).min(1),
        })
      )
      .mutation(({ input, ctx }) =>
        createSale({ ...input, userId: ctx.user.id })
      ),
    updateSale: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          date: z.string(),
          channel: z.string().optional(),
          customerName: z.string().optional(),
          customerPhone: z.string().optional(),
          customerId: z.number().int().positive().nullable().optional(),
          total: z.number().nonnegative(),
          totalCost: z.number().nonnegative(),
          costKnown: z.boolean().optional(),
          description: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        updateSale(input.id, { ...input, userId: ctx.user.id })
      ),
    updateCustomer: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          name: z.string().min(2),
          phone: z.string().optional(),
          locality: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        updateCustomer(input.id, { ...input, userId: ctx.user.id })
      ),
    deleteCustomer: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input, ctx }) => deleteCustomer(input.id, ctx.user.id)),
    deleteSale: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input, ctx }) => deleteSale(input.id, ctx.user.id)),
    createExpense: protectedProcedure
      .input(
        expenseInput.extend({
          platform: z.string().optional(),
          campaign: z.string().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        createExpense({ ...input, userId: ctx.user.id })
      ),
    updateExpense: protectedProcedure
      .input(expenseInput.extend({ id: z.number().int().positive() }))
      .mutation(({ input, ctx }) =>
        updateExpense(input.id, { ...input, userId: ctx.user.id })
      ),
    deleteExpense: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteExpense(input.id)),
    createLoan: protectedProcedure
      .input(loanInput.omit({ paid: true }))
      .mutation(({ input, ctx }) =>
        createLoan({ ...input, userId: ctx.user.id })
      ),
    updateLoan: protectedProcedure
      .input(loanInput.extend({ id: z.number().int().positive() }))
      .mutation(({ input, ctx }) =>
        updateLoan(input.id, { ...input, userId: ctx.user.id })
      ),
    deleteLoan: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteLoan(input.id)),
    payLoan: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          amount: z.number().positive(),
        })
      )
      .mutation(({ input, ctx }) =>
        payLoan(input.id, input.amount, ctx.user.id)
      ),
    createReceivable: protectedProcedure
      .input(receivableInput.omit({ paid: true }))
      .mutation(({ input, ctx }) =>
        createReceivable({ ...input, userId: ctx.user.id })
      ),
    updateReceivable: protectedProcedure
      .input(receivableInput.extend({ id: z.number().int().positive() }))
      .mutation(({ input, ctx }) =>
        updateReceivable(input.id, { ...input, userId: ctx.user.id })
      ),
    deleteReceivable: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteReceivable(input.id)),
    payReceivable: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          amount: z.number().positive(),
        })
      )
      .mutation(({ input, ctx }) =>
        payReceivable(input.id, input.amount, ctx.user.id)
      ),
    createAd: protectedProcedure
      .input(adInput)
      .mutation(({ input, ctx }) =>
        createAd({ ...input, userId: ctx.user.id })
      ),
    updateAd: protectedProcedure
      .input(adInput.extend({ id: z.number().int().positive() }))
      .mutation(({ input, ctx }) =>
        updateAd(input.id, { ...input, userId: ctx.user.id })
      ),
    deleteAd: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteAd(input.id)),
    updateObjective: protectedProcedure
      .input(objectiveInput.extend({ id: z.number().int().positive() }))
      .mutation(({ input, ctx }) =>
        updateObjective(input.id, { ...input, userId: ctx.user.id })
      ),
    deleteObjective: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteObjective(input.id)),
  }),
});

export type AppRouter = typeof appRouter;
