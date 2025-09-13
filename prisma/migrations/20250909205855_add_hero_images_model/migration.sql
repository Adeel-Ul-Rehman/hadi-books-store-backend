-- CreateTable
CREATE TABLE "hero_images" (
    "id" SERIAL NOT NULL,
    "image_url" VARCHAR(500) NOT NULL,
    "alt_text" VARCHAR(200),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "hero_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hero_images_image_url_key" ON "hero_images"("image_url");
