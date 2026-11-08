-- Hizmet sözleşmesi bireysel koçları da kapsar. Yönetimden düzenlenip bu parçası değişmiş metne dokunulmaz.
UPDATE "Page" SET "content" = REPLACE("content", $pk$başvuran etüt merkezi ("Kurum")$pk$, $pk$başvuran etüt merkezi ya da bireysel koç ("Kurum")$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$kurum-hizmet-sozlesmesi$pk$;
