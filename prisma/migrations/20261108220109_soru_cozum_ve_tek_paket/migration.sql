-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "questionSessionPromised" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Center" ALTER COLUMN "edition" SET DEFAULT 'ETUT';

-- AlterTable
ALTER TABLE "LessonLink" ADD COLUMN     "isQuestionSession" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "offersQuestionSession" BOOLEAN NOT NULL DEFAULT false;
