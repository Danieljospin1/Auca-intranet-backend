const cloudinary = require("./cloudinary");

const getFileCategory = (mimetype) => {
  if (mimetype.startsWith('image/'))  return 'image';
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype.startsWith('video/'))  return 'video';
  return 'raw';
};

const getResourceType = (category) => {
  if (category === 'image') return 'image';
  if (category === 'pdf')   return 'image'; // 'image' enables page rendering for thumbnails
  if (category === 'video') return 'video';
  return 'raw';
};

// Generate first-page thumbnail URL from a PDF stored under image/upload
const generatePdfThumbnail = (pdfUrl) => {
  return pdfUrl.replace(
    '/upload/',
    '/upload/w_400,h_560,c_fit,pg_1,f_jpg,q_auto/'
  );
};

// Strip extension from filename to use as public_id.
// Cloudinary appends the correct extension automatically,
// so passing the full filename causes doubling e.g. "file.pdf.pdf"
const stripExtension = (filename) => {
  return filename.replace(/\.[^/.]+$/, '');
};

const uploadFile = async (fileBuffer, isPost, mimetype, originalName) => {
  const category     = getFileCategory(mimetype);
  const resourceType = getResourceType(category);

  // Sanitize and strip extension — Cloudinary adds it back automatically
  const sanitizedName = originalName
    ? stripExtension(originalName)
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '')
    : undefined;

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder:        isPost ? 'posts' : 'profiles',
        resource_type: resourceType,
        quality:       'auto',
        fetch_format:  category === 'image' ? 'auto' : undefined,
        // public_id without extension — Cloudinary appends it from the file
        public_id:     category === 'image' ? undefined : sanitizedName,
      },
      (error, result) => {
        if (error) return reject(error);

        const uploadedUrl = result.secure_url;

        // Blurred placeholder — images only
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

        let thumbnailUrl = null;
        let originalUrl  = uploadedUrl;

        if (category === 'image') {
          thumbnailUrl = uploadedUrl;
        }

        if (category === 'pdf') {
          // thumbnailUrl uses image/upload with page-1 transform
          thumbnailUrl = generatePdfThumbnail(uploadedUrl);
          // originalUrl stays as image/upload — this is the correct delivery
          // URL for PDFs uploaded as resource_type 'image' on Cloudinary.
          // The raw/upload path does NOT work for these files.
          // Make sure "Allow delivery of PDF and ZIP files" is enabled
          // in Cloudinary Console → Settings → Security.
          originalUrl = uploadedUrl;
        }

        resolve({
          originalUrl,
          thumbnailUrl,
          blurredUrl,
          resourceType: category,
        });
      }
    ).end(fileBuffer);
  });
};

module.exports = uploadFile;