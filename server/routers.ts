import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { createExpense, createLoan, createProduct, createReceivable, createSale, adjustStock, getDashboard, listAds, listCustomers, listExpenses, listLoans, listObjectives, listProducts, listReceivables, listSales, payLoan, payReceivable } from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";

const saleItem = z.object({
  productId: z.number().int().positive().optional(),
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  unitCost: z.number().nonnegative().optional(),
  fromInventory: z.boolean().default(false),
  supplier: z.string().optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  business: router({
    dashboard: protectedProcedure.input(z.object({ from: z.string().optional(), to: z.string().optional() }).optional()).query(({ input }) => getDashboard(input?.from, input?.to)),
    products: protectedProcedure.input(z.object({ search: z.string().optional(), category: z.string().optional() }).optional()).query(({ input }) => listProducts(input?.search, input?.category)),
    sales: protectedProcedure.input(z.object({ limit: z.number().int().positive().max(200).optional() }).optional()).query(({ input }) => listSales(input?.limit ?? 30)),
    customers: protectedProcedure.query(() => listCustomers()),
    expenses: protectedProcedure.query(() => listExpenses()),
    loans: protectedProcedure.query(() => listLoans()),
    ads: protectedProcedure.query(() => listAds()),
    objectives: protectedProcedure.query(() => listObjectives()),
    receivables: protectedProcedure.query(() => listReceivables()),
    createProduct: protectedProcedure.input(z.object({ name: z.string().min(2), category: z.string().min(1), supplier: z.string().optional(), stock: z.number().int().nonnegative(), cost: z.number().nonnegative(), minStock: z.number().int().nonnegative().optional() })).mutation(({ input, ctx }) => createProduct({ ...input, userId: ctx.user.id })),
    adjustStock: protectedProcedure.input(z.object({ productId: z.number().int().positive(), quantity: z.number().int(), type: z.enum(["purchase", "adjustment", "return"]), unitCost: z.number().nonnegative().optional(), notes: z.string().optional() })).mutation(({ input, ctx }) => adjustStock({ ...input, userId: ctx.user.id })),
    createSale: protectedProcedure.input(z.object({ date: z.string(), channel: z.string().optional(), customerName: z.string().optional(), customerPhone: z.string().optional(), customerId: z.number().int().positive().optional(), notes: z.string().optional(), items: z.array(saleItem).min(1) })).mutation(({ input, ctx }) => createSale({ ...input, userId: ctx.user.id })),
    createExpense: protectedProcedure.input(z.object({ date: z.string(), category: z.string(), description: z.string().min(2), amount: z.number().nonnegative(), type: z.string().optional(), platform: z.string().optional(), campaign: z.string().optional(), notes: z.string().optional() })).mutation(({ input, ctx }) => createExpense({ ...input, userId: ctx.user.id })),
    createLoan: protectedProcedure.input(z.object({ kind: z.enum(["loan", "payable_merch", "internal"]), counterparty: z.string().min(2), description: z.string().optional(), currency: z.string().default("USD"), principal: z.number().positive(), dueDate: z.string().optional(), startDate: z.string().optional(), notes: z.string().optional() })).mutation(({ input, ctx }) => createLoan({ ...input, userId: ctx.user.id })),
    payLoan: protectedProcedure.input(z.object({ id: z.number().int().positive(), amount: z.number().positive() })).mutation(({ input, ctx }) => payLoan(input.id, input.amount, ctx.user.id)),
    createReceivable: protectedProcedure.input(z.object({ customerName: z.string().min(2), phone: z.string().optional(), description: z.string().optional(), principal: z.number().positive(), dueDate: z.string().optional(), notes: z.string().optional() })).mutation(({ input, ctx }) => createReceivable({ ...input, userId: ctx.user.id })),
    payReceivable: protectedProcedure.input(z.object({ id: z.number().int().positive(), amount: z.number().positive() })).mutation(({ input, ctx }) => payReceivable(input.id, input.amount, ctx.user.id)),
  }),
});

export type AppRouter = typeof appRouter;
