-- CreateTable
CREATE TABLE "vehicle_brands" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "vehicle_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_models" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "date_from" TEXT,
    "date_to" TEXT,
    "brand_id" INTEGER NOT NULL,

    CONSTRAINT "vehicle_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_types" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "cc" INTEGER,
    "fuel_type" TEXT,
    "hp" INTEGER,
    "kwt" INTEGER,
    "year_of_constr_from" TEXT,
    "year_of_constr_to" TEXT,
    "model_id" INTEGER NOT NULL,

    CONSTRAINT "vehicle_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_type_details" (
    "id" BIGINT NOT NULL,
    "vehicle_type_id" INTEGER NOT NULL,
    "brake_system" TEXT,
    "car_id" INTEGER,
    "ccm_tech" INTEGER,
    "construction_type" TEXT,
    "cylinder" INTEGER,
    "cylinder_capacity_ccm" INTEGER,
    "cylinder_capacity_liter" INTEGER,
    "fuel_type" TEXT,
    "fuel_type_process" TEXT,
    "impulsion_type" TEXT,
    "manu_id" INTEGER,
    "manu_name" TEXT,
    "mod_id" INTEGER,
    "model_name" TEXT,
    "motor_type" TEXT,
    "power_hp_from" INTEGER,
    "power_hp_to" INTEGER,
    "power_kw_from" INTEGER,
    "power_kw_to" INTEGER,
    "type_name" TEXT,
    "type_number" INTEGER,
    "valves" INTEGER,
    "year_of_constr_from" TEXT,
    "year_of_constr_to" TEXT,
    "rmi_type_id" INTEGER,
    "motor_codes" JSONB,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_type_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_brands_name_key" ON "vehicle_brands"("name");

-- CreateIndex
CREATE INDEX "vehicle_models_brand_id_idx" ON "vehicle_models"("brand_id");

-- CreateIndex
CREATE INDEX "vehicle_models_brand_id_name_idx" ON "vehicle_models"("brand_id", "name");

-- CreateIndex
CREATE INDEX "vehicle_types_model_id_idx" ON "vehicle_types"("model_id");

-- CreateIndex
CREATE INDEX "vehicle_type_details_vehicle_type_id_idx" ON "vehicle_type_details"("vehicle_type_id");

-- AddForeignKey
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "vehicle_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_types" ADD CONSTRAINT "vehicle_types_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "vehicle_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_type_details" ADD CONSTRAINT "vehicle_type_details_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "vehicle_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
