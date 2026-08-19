-- CreateEnum
CREATE TYPE "userSystemRole" AS ENUM ('USER', 'IT_ADMIN', 'HALL_ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "userStatus" AS ENUM ('REGISTERED', 'UNREGISTERED');

-- CreateEnum
CREATE TYPE "reservationStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED', 'FOR_APPROVAL', 'FOR_REVIEW');

-- CreateTable
CREATE TABLE "Users" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" "userStatus" NOT NULL DEFAULT 'UNREGISTERED',
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "systemRole" "userSystemRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentType" (
    "id" SERIAL NOT NULL,
    "item_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "EquipmentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" SERIAL NOT NULL,
    "item_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "item_brand" TEXT,
    "item_number" TEXT,
    "item_type" TEXT NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HallType" (
    "id" SERIAL NOT NULL,
    "type_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "HallType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hall" (
    "id" SERIAL NOT NULL,
    "hall_id" TEXT NOT NULL,
    "hall_name" TEXT NOT NULL,

    CONSTRAINT "Hall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HallReservation" (
    "id" SERIAL NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "attendees_qty" INTEGER NOT NULL,
    "hall_type" TEXT NOT NULL,
    "date_appointment" TIMESTAMP(3) NOT NULL,
    "time_from" TIMESTAMP(3) NOT NULL,
    "time_to" TIMESTAMP(3) NOT NULL,
    "other_request" TEXT,
    "status" "reservationStatus" NOT NULL DEFAULT 'PENDING',
    "notifyUser" BOOLEAN NOT NULL DEFAULT false,
    "readByUser" BOOLEAN NOT NULL DEFAULT false,
    "readByHallAdmin" BOOLEAN NOT NULL DEFAULT false,
    "readByIT" BOOLEAN NOT NULL DEFAULT false,
    "readBySuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedByUserAt" TIMESTAMP(3),
    "deletedByHallAdminAt" TIMESTAMP(3),
    "deletedByITAt" TIMESTAMP(3),
    "deletedBySuperAdminAt" TIMESTAMP(3),

    CONSTRAINT "HallReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Logs" (
    "id" SERIAL NOT NULL,
    "log_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "changes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reservationId" TEXT,
    "reservation_type" TEXT,
    "personal_info" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EquipmentToHallReservation" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_EquipmentToHallReservation_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_HallToHallReservation" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_HallToHallReservation_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Users_user_id_key" ON "Users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Users_email_key" ON "Users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentType_item_id_key" ON "EquipmentType"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_item_id_key" ON "Equipment"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "HallType_type_id_key" ON "HallType"("type_id");

-- CreateIndex
CREATE UNIQUE INDEX "Hall_hall_id_key" ON "Hall"("hall_id");

-- CreateIndex
CREATE UNIQUE INDEX "HallReservation_reservation_id_key" ON "HallReservation"("reservation_id");

-- CreateIndex
CREATE UNIQUE INDEX "Logs_log_id_key" ON "Logs"("log_id");

-- CreateIndex
CREATE INDEX "_EquipmentToHallReservation_B_index" ON "_EquipmentToHallReservation"("B");

-- CreateIndex
CREATE INDEX "_HallToHallReservation_B_index" ON "_HallToHallReservation"("B");

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_item_type_fkey" FOREIGN KEY ("item_type") REFERENCES "EquipmentType"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallReservation" ADD CONSTRAINT "HallReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Logs" ADD CONSTRAINT "Logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Logs" ADD CONSTRAINT "Logs_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "HallReservation"("reservation_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EquipmentToHallReservation" ADD CONSTRAINT "_EquipmentToHallReservation_A_fkey" FOREIGN KEY ("A") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EquipmentToHallReservation" ADD CONSTRAINT "_EquipmentToHallReservation_B_fkey" FOREIGN KEY ("B") REFERENCES "HallReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_HallToHallReservation" ADD CONSTRAINT "_HallToHallReservation_A_fkey" FOREIGN KEY ("A") REFERENCES "Hall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_HallToHallReservation" ADD CONSTRAINT "_HallToHallReservation_B_fkey" FOREIGN KEY ("B") REFERENCES "HallReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
