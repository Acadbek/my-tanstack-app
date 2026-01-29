import { faker } from '@faker-js/faker'
import { db } from './index'
import { comments, posts } from './schema'

function randomDateWithinLastDays(days: number): Date {
  const now = Date.now()
  const maxMs = days * 24 * 60 * 60 * 1000
  const offset = Math.floor(Math.random() * maxMs)
  return new Date(now - offset)
}

async function main() {
  const existing = await db.query.posts.findFirst()
  if (existing) {
    console.log('Seed skipped: posts already exist')
    return
  }

  const createdPost = await db
    .insert(posts)
    .values({
      imageUrl: faker.image.urlLoremFlickr({ category: 'product' }),
      caption: faker.lorem.sentence(),
      createdAt: randomDateWithinLastDays(7),
    })
    .returning({ id: posts.id })

  const postId = createdPost[0]?.id
  if (!postId) throw new Error('Failed to insert post')

  const demoComments = Array.from({ length: 40 }).map(() => {
    const isLead = faker.datatype.boolean({ probability: 0.25 })
    return {
      postId,
      username: faker.internet.username(),
      text: isLead
        ? faker.helpers.arrayElement([
            'Narxi qancha?',
            'Qanaqa qilib zakaz qilaman?',
            'Chegirma bormi?',
            'Nechpul bo‘ladi?',
          ])
        : faker.lorem.sentence(),
      sentiment: faker.helpers.arrayElement(['positive', 'neutral', 'negative']),
      isLead,
      aiReply: null,
      status: 'pending',
      createdAt: randomDateWithinLastDays(7),
    }
  })

  await db.insert(comments).values(demoComments)

  console.log(`Seeded: 1 post + ${demoComments.length} comments`) 
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
