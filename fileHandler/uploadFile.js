const cloudinary = require("./cloudinary");

const getFileCategory = (mimetype) => {
  if (mimetype.startsWith('image/'))  return 'image';
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype.startsWith('video/'))  return 'video';
  return 'raw';
};

const getResourceType = (category) => {
  if (category === 'image') return 'image';
  if (category === 'pdf')   return 'image'; // must be 'image' to enable page rendering for thumbnail
  if (category === 'video') return 'video';
  return 'raw';
};

// Generate first-page thumbnail from a PDF stored under image/upload
const generatePdfThumbnail = (pdfUrl) => {
  return pdfUrl.replace(
    '/upload/',
    '/upload/w_400,h_560,c_fit,pg_1,f_jpg,q_auto/'
  );
};

// PDFs are uploaded as resource_type 'image' (needed for thumbnail generation),
// but that makes the secure_url use the image/upload delivery path which
// cannot serve raw PDF bytes for download.
//
// Fix: swap 'image/upload' → 'raw/upload' in the URL so the download link
// points to Cloudinary's raw delivery pipeline which serves the actual file.
const getPdfDownloadUrl = (imageUploadUrl) => {
  return imageUploadUrl.replace('/image/upload/', '/raw/upload/');
};

const uploadFile = async (fileBuffer, isPost, mimetype, originalName) => {
  const category     = getFileCategory(mimetype);
  const resourceType = getResourceType(category);

  const sanitizedName = originalName
    ? originalName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')
    : undefined;

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder:        isPost ? 'posts' : 'profiles',
        resource_type: resourceType,
        quality:       'auto',
        fetch_format:  category === 'image' ? 'auto' : undefined,
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
          // thumbnailUrl → image/upload with page-1 transform (works because resource_type is image)
          thumbnailUrl = generatePdfThumbnail(uploadedUrl);
          // originalUrl → raw/upload so the download link serves actual PDF bytes
          originalUrl  = getPdfDownloadUrl(uploadedUrl);
        }

        resolve({
          originalUrl,   // for PDFs: raw/upload URL (downloadable)
          thumbnailUrl,  // for PDFs: image/upload URL with page-1 render
          blurredUrl,
          resourceType: category,
        });
      }
    ).end(fileBuffer);
  });
};

module.exports = uploadFile;