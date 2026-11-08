-- Ücretli soru çözüm kapandı: hizmet türü ve o hizmetteki öğretmen teklifleri pasife alınır (kayıtlar silinmez).
UPDATE "ServiceType" SET "isActive" = false WHERE "slug" = 'soru-cozum';
UPDATE "TeacherOffering" SET "isActive" = false WHERE "serviceTypeId" IN (SELECT "id" FROM "ServiceType" WHERE "slug" = 'soru-cozum');

-- Tek ürün: Etüt Merkezi. Dershane paketindeki kurumlar ve başvurular Etüt Merkezi olur; bütün modüller herkese açıktır.
UPDATE "Center" SET "edition" = 'ETUT' WHERE "edition" = 'DERSHANE';
UPDATE "Center" SET "kind" = 'ETUT' WHERE "kind" = 'DERSHANE';
UPDATE "CenterApplication" SET "edition" = 'ETUT' WHERE "edition" = 'DERSHANE';
UPDATE "CenterApplication" SET "kind" = 'ETUT' WHERE "kind" = 'DERSHANE';
