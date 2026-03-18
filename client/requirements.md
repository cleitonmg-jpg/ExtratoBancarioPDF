## Packages
react-dropzone | For drag-and-drop PDF file uploads
framer-motion | For smooth page transitions and loading animations
date-fns | For formatting dates in Portuguese
clsx | For conditional class names
tailwind-merge | For merging tailwind classes safely

## Notes
- Upload endpoint uses multipart/form-data and expects a file field named `pdf`.
- Fetch requests for upload must NOT set the Content-Type header manually (the browser needs to set it with the multipart boundary).
- The parsing process might take several seconds, so the UI needs a prominent, persistent loading state during upload.
