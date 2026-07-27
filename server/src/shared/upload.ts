// Спільний multer-інстанс для файлових ендпоінтів (CV upload, LinkedIn import).
import multer from "multer";

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
