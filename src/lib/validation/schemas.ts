import { z } from 'zod'

export const phoneSchema = z
  .string()
  .min(9)
  .max(15)
  .regex(/^[+0-9\s-]+$/, 'Invalid phone number')

export const uuidSchema = z.string().uuid('Invalid ID')

export const latSchema = z.number().min(-90).max(90)
export const lngSchema = z.number().min(-180).max(180)

export const ratingSchema = z.number().int().min(1).max(5)

export const moneySchema = z.number().min(0).finite()

export const quantitySchema = z.number().int().min(1).max(999)

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(6).max(128),
})

export const registerSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(6).max(128),
  name: z.string().min(2).max(100),
  role: z.enum(['CUSTOMER', 'VENDOR', 'RIDER']).default('CUSTOMER'),
  businessName: z.string().min(2).max(120).optional(),
  location: z.string().max(200).optional(),
  vehicleType: z.string().max(50).optional(),
})

export const addressSchema = z.object({
  label: z.string().min(1).max(50),
  estate: z.string().min(1).max(120),
  street: z.string().max(200).optional().nullable(),
  landmark: z.string().max(200).optional().nullable(),
  latitude: latSchema.optional().nullable(),
  longitude: lngSchema.optional().nullable(),
  isDefault: z.boolean().optional(),
})

export const addressUpdateSchema = addressSchema.partial()

export const cartAddSchema = z.object({
  vendorProductId: uuidSchema,
  quantity: quantitySchema.default(1),
  instructions: z.string().max(300).optional().nullable(),
})

export const cartUpdateSchema = z.object({
  id: uuidSchema,
  quantity: z.number().int().min(0).max(999).optional(),
  instructions: z.string().max(300).optional().nullable(),
})

export const promoValidateSchema = z.object({
  code: z.string().min(1).max(40),
  subtotal: moneySchema.default(0),
  deliveryFee: moneySchema.default(0),
})

export const reviewSchema = z.object({
  orderId: uuidSchema,
  vendorRating: ratingSchema,
  productRating: ratingSchema.optional(),
  comment: z.string().max(1000).optional().nullable(),
})

export const riderLocationSchema = z.object({
  latitude: latSchema,
  longitude: lngSchema,
})

export const deliveryStatusSchema = z.object({
  status: z.enum(['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED']),
})

export const deliveryAcceptSchema = z
  .object({
    deliveryId: uuidSchema.optional(),
    orderId: uuidSchema.optional(),
  })
  .refine((d) => d.deliveryId || d.orderId, {
    message: 'deliveryId or orderId required',
  })

export const orderStatusSchema = z.object({
  status: z.string().min(1).max(40),
  note: z.string().max(500).optional().nullable(),
})

export const orderCreateSchema = z.object({
  vendorId: uuidSchema,
  addressId: uuidSchema.optional().nullable(),
  promoCode: z.string().max(40).optional().nullable(),
  deliveryNotes: z.string().max(500).optional().nullable(),
  preferredTime: z.string().max(80).optional().nullable(),
  paymentMethod: z.enum(['MPESA', 'CASH_ON_DELIVERY']).default('MPESA'),
  phone: phoneSchema.optional().nullable(),
})

export const vendorProductPatchSchema = z.object({
  id: uuidSchema,
  price: moneySchema.optional(),
  stockStatus: z.enum(['IN_STOCK', 'LOW', 'OUT_OF_STOCK']).optional(),
  isAvailable: z.boolean().optional(),
  customName: z.string().max(120).optional().nullable(),
})

export const vendorProductAddSchema = z
  .object({
    productId: uuidSchema.optional(),
    customName: z.string().min(1).max(120).optional(),
    price: moneySchema,
    stockStatus: z.enum(['IN_STOCK', 'LOW', 'OUT_OF_STOCK']).default('IN_STOCK'),
    isAvailable: z.boolean().default(true),
    unit: z.string().max(40).optional(),
    categoryId: uuidSchema.optional(),
  })
  .refine((d) => d.productId || d.customName, {
    message: 'productId or customName required',
  })

export const payOrderSchema = z.object({
  phone: phoneSchema.optional(),
})

export const favoriteSchema = z
  .object({
    vendorId: uuidSchema.optional(),
    productId: uuidSchema.optional(),
  })
  .refine((d) => d.vendorId || d.productId, {
    message: 'vendorId or productId required',
  })

export const notificationMarkSchema = z.object({
  id: uuidSchema.optional(),
  markAll: z.boolean().optional(),
})

export const adminVendorStatusSchema = z.object({
  vendorId: uuidSchema,
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']),
})

export const adminCategorySchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(80).optional(),
  isActive: z.boolean().optional(),
})

export const adminCategoryPatchSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(80).optional(),
  slug: z.string().min(1).max(80).optional(),
  isActive: z.boolean().optional(),
})

export const adminPayoutSchema = z.object({
  vendorId: uuidSchema,
  amount: moneySchema,
  note: z.string().max(300).optional().nullable(),
})

export const adminProductSchema = z.object({
  name: z.string().min(1).max(120),
  unit: z.string().min(1).max(40),
  categoryId: uuidSchema,
  basePrice: moneySchema.optional().nullable(),
  image: z.string().max(500).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
})

export const adminProductPatchSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(120).optional(),
  unit: z.string().min(1).max(40).optional(),
  basePrice: moneySchema.optional().nullable(),
  isActive: z.boolean().optional(),
})

export function parseBody<T>(schema: z.ZodSchema<T>, data: unknown) {
  const result = schema.safeParse(data)
  if (!result.success) {
    return { success: false as const, error: result.error.flatten() }
  }
  return { success: true as const, data: result.data }
}
