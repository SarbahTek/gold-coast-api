import { PrismaClient, ProductCategory, ProductSubcategory, FaqCategory } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ─── Admin User ─────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin123!', 12)
  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@goldcoasthair.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@goldcoasthair.com',
      passwordHash: adminPassword,
      role: 'superadmin',
    },
  })
  console.log('✅ Admin user:', admin.email)

  // ─── Products ────────────────────────────────────────────────────────────────
  const products = await Promise.all([
    prisma.product.upsert({
      where: { id: 1 },
      update: {},
      create: {
        name: 'Body Wave Full Lace Wig',
        description: 'Luxurious 100% human hair body wave full lace wig. Natural shine, minimal shedding, long-lasting.',
        category: ProductCategory.wig,
        subcategory: ProductSubcategory.full_lace,
        price: 1750,
        originalPrice: 2100,
        discountPercent: 17,
        isOnSale: true,
        isFeatured: true,
        isNewArrival: true,
        stockQty: 25,
        images: {
          create: [{ imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', isPrimary: true, sortOrder: 1 }],
        },
        sizes: {
          create: [
            { size: '18"', stockQty: 8 },
            { size: '20"', stockQty: 9 },
            { size: '22"', stockQty: 5 },
            { size: '24"', stockQty: 3 },
          ],
        },
      },
    }),
    prisma.product.upsert({
      where: { id: 2 },
      update: {},
      create: {
        name: 'Deep Curly HD Lace Wig',
        description: 'Premium HD lace for an undetectable hairline. Deep curly texture, bouncy and defined curls.',
        category: ProductCategory.wig,
        subcategory: ProductSubcategory.hd_lace,
        price: 150525,
        originalPrice: 200700,
        discountPercent: 25,
        isOnSale: true,
        isFeatured: true,
        isNewArrival: false,
        stockQty: 18,
        images: {
          create: [{ imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', isPrimary: true, sortOrder: 1 }],
        },
        sizes: {
          create: [
            { size: '16"', stockQty: 6 },
            { size: '18"', stockQty: 7 },
            { size: '20"', stockQty: 5 },
          ],
        },
      },
    }),
    prisma.product.upsert({
      where: { id: 3 },
      update: {},
      create: {
        name: 'Kinky Curly HD Lace Wig',
        description: '4C kinky curly texture. Perfect for a natural look. 100% human hair, undetectable HD lace.',
        category: ProductCategory.wig,
        subcategory: ProductSubcategory.hd_lace,
        price: 136546,
        originalPrice: 195065,
        discountPercent: 30,
        isOnSale: true,
        isFeatured: false,
        isNewArrival: false,
        stockQty: 12,
        images: {
          create: [{ imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', isPrimary: true, sortOrder: 1 }],
        },
        sizes: {
          create: [
            { size: '16"', stockQty: 4 },
            { size: '18"', stockQty: 4 },
            { size: '20"', stockQty: 2 },
            { size: '22"', stockQty: 2 },
          ],
        },
      },
    }),
    prisma.product.upsert({
      where: { id: 4 },
      update: {},
      create: {
        name: 'Bone Straight Wig',
        description: 'Silky straight, high-shine bone straight wig. 100% human hair for the sleek look.',
        category: ProductCategory.wig,
        subcategory: ProductSubcategory.lace_front,
        price: 1050,
        originalPrice: 1400,
        discountPercent: 25,
        isOnSale: true,
        isFeatured: true,
        isNewArrival: true,
        stockQty: 30,
        images: {
          create: [{ imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', isPrimary: true, sortOrder: 1 }],
        },
        sizes: {
          create: [
            { size: '14"', stockQty: 10 },
            { size: '16"', stockQty: 10 },
            { size: '18"', stockQty: 7 },
            { size: '20"', stockQty: 3 },
          ],
        },
      },
    }),
    prisma.product.upsert({
      where: { id: 5 },
      update: {},
      create: {
        name: 'Clip-In Extensions Set',
        description: '7-piece clip-in extension set. Easy to apply, natural blend, 100% human hair.',
        category: ProductCategory.extension,
        subcategory: ProductSubcategory.clip_in,
        price: 450,
        originalPrice: null,
        discountPercent: null,
        isOnSale: false,
        isFeatured: false,
        isNewArrival: true,
        stockQty: 40,
        images: {
          create: [{ imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', isPrimary: true, sortOrder: 1 }],
        },
        sizes: {
          create: [
            { size: '16"', stockQty: 15 },
            { size: '18"', stockQty: 15 },
            { size: '20"', stockQty: 10 },
          ],
        },
      },
    }),
  ])
  console.log(`✅ ${products.length} products seeded`)

  // ─── Bundles ──────────────────────────────────────────────────────────────
  const starterBundle = await prisma.bundle.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Starter Glam Bundle',
      description: 'Everything a first-timer needs. Our carefully curated bundle so you start rocking products together so you get the best bang for your buck.',
      price: 2250,
      originalPrice: 3200,
      isLimited: false,
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      items: {
        create: [
          { productId: products[0]!.id, size: '18"', quantity: 1 },
          { productId: products[4]!.id, size: '18"', quantity: 1 },
        ],
      },
    },
  })

  const bossBundle = await prisma.bundle.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: 'Boss Lady Bundle',
      description: 'For the woman who can switch up her look any day. Two styles, endless versatility.',
      price: 3150,
      originalPrice: 4500,
      isLimited: true,
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      items: {
        create: [
          { productId: products[1]!.id, size: '18"', quantity: 1 },
          { productId: products[3]!.id, size: '16"', quantity: 1 },
        ],
      },
    },
  })
  console.log('✅ 2 bundles seeded')

  // ─── Active Promotion ─────────────────────────────────────────────────────
  await prisma.promotion.upsert({
    where: { id: 1 },
    update: {},
    create: {
      title: 'FLASH SALE — LIMITED TIME',
      discountPercent: 30,
      maxSavings: 500,
      freeShippingThreshold: 500,
      itemsOnSale: 14,
      startAt: new Date(),
      endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      isActive: true,
    },
  })
  console.log('✅ Promotion seeded')

  // ─── FAQs ─────────────────────────────────────────────────────────────────
  const faqs = [
    { category: FaqCategory.shipping_delivery, question: 'How long does shipping take?', answer: 'Standard shipping takes 3-7 business days Australia-wide. Express shipping (1-3 days) is available at checkout.', sortOrder: 1 },
    { category: FaqCategory.shipping_delivery, question: 'Do you ship internationally?', answer: 'Yes! We ship worldwide. International orders typically take 7-14 business days.', sortOrder: 2 },
    { category: FaqCategory.shipping_delivery, question: 'How much does shipping cost?', answer: 'Free shipping on orders over GHS 500. Standard shipping is GHS 50. Express is GHS 100.', sortOrder: 3 },
    { category: FaqCategory.shipping_delivery, question: 'How do I track my order?', answer: 'Your order number is sent via WhatsApp when your order is placed. Use it on our Track My Order page.', sortOrder: 4 },
    { category: FaqCategory.shipping_delivery, question: 'What happens if my package is delayed?', answer: 'Contact us on WhatsApp or email and we will investigate within 24 hours.', sortOrder: 5 },
    { category: FaqCategory.returns_exchanges, question: 'What is your return policy?', answer: 'We accept returns within 14 days of delivery for unopened, unworn items in original packaging.', sortOrder: 1 },
    { category: FaqCategory.returns_exchanges, question: 'How do I start a return?', answer: 'Contact us via WhatsApp or email with your order number and reason for return. We will guide you through the process.', sortOrder: 2 },
    { category: FaqCategory.hair_care, question: 'How do I care for my wig?', answer: 'Use sulfate-free shampoo, condition regularly, and store on a wig stand. Avoid excessive heat styling.', sortOrder: 1 },
    { category: FaqCategory.hair_care, question: 'Can I dye or bleach the hair?', answer: 'Yes, our 100% human hair can be colored. We recommend consulting a professional stylist.', sortOrder: 2 },
  ]

  for (const faq of faqs) {
    await prisma.faq.create({ data: faq }).catch(() => {}) // ignore dupes on re-seed
  }
  console.log('✅ FAQs seeded')

  console.log('\n🎉 Seed complete!')
  console.log('📧 Admin login: admin@goldcoasthair.com / Admin123!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
