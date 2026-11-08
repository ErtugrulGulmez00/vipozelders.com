-- Rehber yazılarında "dershane" geçen cümleler. Yönetimden düzenlenip bu parçası değişmiş yazılara dokunulmaz.
UPDATE "BlogPost" SET "content" = REPLACE("content", 'Etüt merkezi ya da dershaneniz Pi Kampüs kurum panelini', 'Etüt merkeziniz Pi Kampüs kurum panelini') WHERE "slug" = 'deneme-sinavi-sonuclari-nasil-analiz-edilir';
UPDATE "BlogPost" SET "content" = REPLACE("content", 'Okul, dershane ya da etüt saatleri', 'Okul ya da etüt saatleri') WHERE "slug" = 'haftalik-calisma-programi-nasil-hazirlanir';
UPDATE "BlogPost" SET "content" = REPLACE("content", 'Etüt merkezi ve dershane yöneticilerinin', 'Etüt merkezi yöneticilerinin') WHERE "slug" = 'etut-merkezlerinde-veli-iletisimi';
