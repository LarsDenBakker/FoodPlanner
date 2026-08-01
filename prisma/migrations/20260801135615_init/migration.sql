-- CreateEnum
CREATE TYPE "MealSlot" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hashedPassword" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT NOT NULL,
    "servings" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlanEntry" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mealSlot" "MealSlot" NOT NULL,
    "recipeId" TEXT NOT NULL,
    "servings" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealPlanEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PantryItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "category" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PantryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryList" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroceryList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryListItem" (
    "id" TEXT NOT NULL,
    "groceryListId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "requiredQuantity" DOUBLE PRECISION,
    "pantryQuantity" DOUBLE PRECISION,
    "remainingQuantity" DOUBLE PRECISION,
    "unitMismatch" BOOLEAN NOT NULL DEFAULT false,
    "isChecked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GroceryListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "RecipeIngredient_recipeId_idx" ON "RecipeIngredient"("recipeId");

-- CreateIndex
CREATE INDEX "MealPlanEntry_date_idx" ON "MealPlanEntry"("date");

-- CreateIndex
CREATE INDEX "PantryItem_name_idx" ON "PantryItem"("name");

-- CreateIndex
CREATE INDEX "GroceryList_startDate_endDate_idx" ON "GroceryList"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "GroceryListItem_groceryListId_idx" ON "GroceryListItem"("groceryListId");

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryListItem" ADD CONSTRAINT "GroceryListItem_groceryListId_fkey" FOREIGN KEY ("groceryListId") REFERENCES "GroceryList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
