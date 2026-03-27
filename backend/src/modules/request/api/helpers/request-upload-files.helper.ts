type UploadedFiles = { [fieldname: string]: Express.Multer.File[] } | undefined;

export type RequestUploadCollection = {
  allFiles: Express.Multer.File[];
  signatureFile: Express.Multer.File | undefined;
};

export const collectRequestUploadFiles = (
  files: UploadedFiles,
): RequestUploadCollection => {
  const documentFiles = [...(files?.["files"] || []), ...(files?.["files[]"] || [])];
  const licenseFiles = files?.["license_file"] || [];
  const signatureFiles = files?.["applicant_signature"] || [];

  return {
    allFiles: [...documentFiles, ...licenseFiles, ...signatureFiles],
    signatureFile: signatureFiles[0],
  };
};

export const collectEligibilityAttachmentUploadFiles = (
  files: UploadedFiles,
): Express.Multer.File[] => [
  ...(files?.["files"] || []),
  ...(files?.["files[]"] || []),
  ...(files?.["license_file"] || []),
];
