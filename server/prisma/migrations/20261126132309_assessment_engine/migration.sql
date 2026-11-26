-- AlterTable
ALTER TABLE "assessment_attempts" ADD COLUMN     "correct_count" INTEGER,
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "focus_losses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "question_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "assessment_questions" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "difficulty" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "explanation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_question_options" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "assessment_question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_attempt_questions" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "option_order" JSONB NOT NULL,
    "selected_option_id" UUID,
    "answered_at" TIMESTAMP(3),
    "is_correct" BOOLEAN,

    CONSTRAINT "assessment_attempt_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessment_questions_assessment_id_difficulty_status_idx" ON "assessment_questions"("assessment_id", "difficulty", "status");

-- CreateIndex
CREATE INDEX "assessment_question_options_question_id_idx" ON "assessment_question_options"("question_id");

-- CreateIndex
CREATE INDEX "assessment_attempt_questions_attempt_id_position_idx" ON "assessment_attempt_questions"("attempt_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_attempt_questions_attempt_id_question_id_key" ON "assessment_attempt_questions"("attempt_id", "question_id");

-- AddForeignKey
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_question_options" ADD CONSTRAINT "assessment_question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "assessment_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempt_questions" ADD CONSTRAINT "assessment_attempt_questions_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "assessment_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempt_questions" ADD CONSTRAINT "assessment_attempt_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "assessment_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempt_questions" ADD CONSTRAINT "assessment_attempt_questions_selected_option_id_fkey" FOREIGN KEY ("selected_option_id") REFERENCES "assessment_question_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
