-- Dersler tam saatte başlar ve 45 ya da 60 dakika sürer.
UPDATE "TeacherOffering" SET "durations" = ARRAY(SELECT d FROM unnest("durations") AS d WHERE d IN (45, 60) ORDER BY d);
UPDATE "TeacherOffering" SET "durations" = ARRAY[60] WHERE cardinality("durations") = 0;
UPDATE "TeacherProfile" SET "bufferMinutes" = 0;
