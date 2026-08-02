import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  const email = process.env.SEED_USER_EMAIL;
  const password = process.env.SEED_USER_PASSWORD;

  if (!email || !password) {
    throw new Error("Set SEED_USER_EMAIL and SEED_USER_PASSWORD in .env before seeding.");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, hashedPassword, name: "Household" },
  });
  console.log(`Seeded user: ${user.email}`);

  const existingRecipeCount = await prisma.recipe.count();
  if (existingRecipeCount > 0) {
    console.log("Recipes already exist, skipping sample data.");
    return;
  }

  const spaghetti = await prisma.recipe.create({
    data: {
      title: "Spaghetti Bolognese",
      description: "Classic weeknight pasta.",
      instructions:
        "1. Brown the beef.\n2. Add tomato sauce and simmer.\n3. Cook spaghetti.\n4. Combine and serve.",
      servings: 4,
      ingredients: {
        create: [
          { name: "spaghetti", quantity: 400, unit: "g", sortOrder: 0 },
          { name: "ground beef", quantity: 500, unit: "g", sortOrder: 1 },
          { name: "tomato sauce", quantity: 1, unit: "jar", sortOrder: 2 },
        ],
      },
    },
  });

  const salad = await prisma.recipe.create({
    data: {
      title: "Simple Green Salad",
      description: "Quick side salad.",
      instructions: "1. Wash and chop lettuce.\n2. Toss with olive oil and vinegar.",
      servings: 2,
      ingredients: {
        create: [
          { name: "lettuce", quantity: 1, unit: "head", sortOrder: 0 },
          { name: "olive oil", quantity: 2, unit: "tbsp", sortOrder: 1 },
        ],
      },
    },
  });

  await prisma.pantryItem.createMany({
    data: [
      { name: "spaghetti", quantity: 200, unit: "g", category: "Pantry" },
      { name: "tomato sauce", quantity: 1, unit: "jar", category: "Pantry" },
      { name: "olive oil", quantity: 500, unit: "ml", category: "Pantry" },
    ],
  });

  const today = new Date();
  const dayOfWeek = today.getUTCDay();
  const monday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - ((dayOfWeek + 6) % 7))
  );
  const wednesday = new Date(monday.getTime() + 2 * 24 * 60 * 60 * 1000);

  await prisma.mealPlanEntry.create({
    data: { date: wednesday, mealSlot: "DINNER", recipeId: spaghetti.id, servings: 4 },
  });

  await prisma.mealPlanEntry.create({
    data: { date: wednesday, mealSlot: "LUNCH", recipeId: salad.id },
  });

  console.log("Seeded sample recipes, pantry items, and meal plan entries.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
