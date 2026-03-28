const cloudinary = require("./cloudinary");

// Detect what kind of file we're dealing with based on mimetype
const getFileCategory = (mimetype) => {
  if (mimetype.startsWith('image/'))          return 'image';
  if (mimetype === 'application/pdf')         return 'pdf';
  if (mimetype.startsWith('video/'))          return 'video';
  return 'raw'; // DOCX, XLSX, PPTX, etc.
};

// Cloudinary resource_type per category
const getResourceType = (category) => {
  if (category === 'image') return 'image';
  if (category === 'pdf')   return 'image'; // PDFs uploaded as image enables page rendering
  if (category === 'video') return 'video';
  return 'raw';
};

// Generate a first-page thumbnail URL from an uploaded PDF's Cloudinary URL
const generatePdfThumbnail = (pdfUrl) => {
  return pdfUrl.replace(
    '/upload/',
    '/upload/w_400,h_560,c_fit,pg_1,f_jpg,q_auto/'
  );
};

/**
 * Uploads any file (image, PDF, DOCX, XLSX, PPTX, etc.) to Cloudinary.
 *
 * @param {Buffer}  fileBuffer   - The raw file buffer from multer (req.file.buffer)
 * @param {boolean} isPost       - true = posts folder, false = profiles folder
 * @param {string}  mimetype     - The file's MIME type (req.file.mimetype)
 * @param {string}  originalName - Original filename (req.file.originalname)
 *
 * @returns {Promise<{
 *   originalUrl:  string,        // direct download / view URL
 *   thumbnailUrl: string | null, // preview image (images + PDFs only)
 *   blurredUrl:   string | null, // blurred placeholder (images only)
 *   resourceType: string,        // 'image' | 'pdf' | 'raw' | 'video'
 * }>}
 */
const uploadFile = async (fileBuffer, isPost, mimetype, originalName) => {
  const category     = getFileCategory(mimetype);
  const resourceType = getResourceType(category);

  // Sanitize filename for use as public_id on non-image uploads
  const sanitizedName = originalName
    ? originalName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')
    : undefined;

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder:        isPost ? 'posts' : 'profiles',
        resource_type: resourceType,
        quality:       'auto',
        fetch_format:  category === 'image' ? 'auto' : undefined, // only for images
        // For non-image files, preserve the original filename as the public_id
        // so Cloudinary keeps the correct extension in the URL
        public_id:     category === 'image' ? undefined : sanitizedName,
      },
      (error, result) => {
        if (error) return reject(error);

        const originalUrl = result.secure_url;

        // Blurred placeholder — images only, posts only
        const blurredUrl = (category === 'image' && isPost)
          ? cloudinary.url(result.public_id, {
              transformation: [
                { width: 600, crop: 'scale' },
                { effect: 'blur:300' },
                { quality: 'auto:low' },
              ],
              secure: true,
            })
          : null;

        // Thumbnail — images use the original URL, PDFs get a page-1 render
        let thumbnailUrl = null;
        if (category === 'image') thumbnailUrl = originalUrl;
        if (category === 'pdf')   thumbnailUrl = generatePdfThumbnail(originalUrl);

        resolve({
          originalUrl,
          thumbnailUrl,
          blurredUrl,
          resourceType: category, // 'image' | 'pdf' | 'raw' | 'video'
        });
      }
    ).end(fileBuffer);
  });
};

module.exports = uploadFile;