-- DropForeignKey
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_author_member_id_fkey";

-- DropForeignKey
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "evidences" DROP CONSTRAINT "evidences_member_id_fkey";

-- DropForeignKey
ALTER TABLE "evidences" DROP CONSTRAINT "evidences_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "materials" DROP CONSTRAINT "materials_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "member_constraints" DROP CONSTRAINT "member_constraints_member_id_fkey";

-- DropForeignKey
ALTER TABLE "member_constraints" DROP CONSTRAINT "member_constraints_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "member_place_profiles" DROP CONSTRAINT "member_place_profiles_member_id_fkey";

-- DropForeignKey
ALTER TABLE "member_place_profiles" DROP CONSTRAINT "member_place_profiles_node_id_fkey";

-- DropForeignKey
ALTER TABLE "member_place_profiles" DROP CONSTRAINT "member_place_profiles_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "member_signals" DROP CONSTRAINT "member_signals_evidence_id_fkey";

-- DropForeignKey
ALTER TABLE "member_signals" DROP CONSTRAINT "member_signals_member_id_fkey";

-- DropForeignKey
ALTER TABLE "member_signals" DROP CONSTRAINT "member_signals_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "place_opinions" DROP CONSTRAINT "place_opinions_member_id_fkey";

-- DropForeignKey
ALTER TABLE "place_opinions" DROP CONSTRAINT "place_opinions_node_id_fkey";

-- DropForeignKey
ALTER TABLE "place_opinions" DROP CONSTRAINT "place_opinions_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "plan_variants" DROP CONSTRAINT "plan_variants_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "planning_context_snapshots" DROP CONSTRAINT "planning_context_snapshots_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "room_node_states" DROP CONSTRAINT "room_node_states_node_id_fkey";

-- DropForeignKey
ALTER TABLE "room_node_states" DROP CONSTRAINT "room_node_states_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "room_place_profiles" DROP CONSTRAINT "room_place_profiles_node_id_fkey";

-- DropForeignKey
ALTER TABLE "room_place_profiles" DROP CONSTRAINT "room_place_profiles_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "trip_members" DROP CONSTRAINT "trip_members_member_id_fkey";

-- DropForeignKey
ALTER TABLE "trip_members" DROP CONSTRAINT "trip_members_trip_id_fkey";

-- AlterTable
ALTER TABLE "chat_messages" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "destination_nodes" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "evidences" ALTER COLUMN "occurred_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "materials" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "member_constraints" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "invalidated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "member_place_profiles" ALTER COLUMN "last_signal_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "last_calculated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "stale_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "member_signals" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "invalidated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "members" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "place_opinions" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "plan_variants" ADD COLUMN     "itinerary" JSONB,
ADD COLUMN     "model_name" TEXT,
ADD COLUMN     "model_version" TEXT,
ADD COLUMN     "planning_context_snapshot_id" TEXT,
ADD COLUMN     "route" JSONB,
ADD COLUMN     "score" DOUBLE PRECISION,
ADD COLUMN     "scoring_breakdown" JSONB,
ADD COLUMN     "validation" JSONB,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "planning_context_snapshots" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "room_node_states" ALTER COLUMN "first_discovered_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "last_interacted_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "last_shown_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "room_place_profiles" ALTER COLUMN "last_calculated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "stale_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "trip_members" ALTER COLUMN "last_seen_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "trips" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "plan_variants_trip_id_created_at_idx" ON "plan_variants"("trip_id", "created_at");

-- AddForeignKey
ALTER TABLE "trip_members" ADD CONSTRAINT "trip_members_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_members" ADD CONSTRAINT "trip_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_author_member_id_fkey" FOREIGN KEY ("author_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_node_states" ADD CONSTRAINT "room_node_states_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_node_states" ADD CONSTRAINT "room_node_states_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "destination_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_signals" ADD CONSTRAINT "member_signals_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_signals" ADD CONSTRAINT "member_signals_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_signals" ADD CONSTRAINT "member_signals_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "evidences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_opinions" ADD CONSTRAINT "place_opinions_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_opinions" ADD CONSTRAINT "place_opinions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_opinions" ADD CONSTRAINT "place_opinions_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "destination_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_constraints" ADD CONSTRAINT "member_constraints_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_constraints" ADD CONSTRAINT "member_constraints_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_place_profiles" ADD CONSTRAINT "member_place_profiles_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_place_profiles" ADD CONSTRAINT "member_place_profiles_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_place_profiles" ADD CONSTRAINT "member_place_profiles_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "destination_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_place_profiles" ADD CONSTRAINT "room_place_profiles_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_place_profiles" ADD CONSTRAINT "room_place_profiles_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "destination_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_context_snapshots" ADD CONSTRAINT "planning_context_snapshots_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
