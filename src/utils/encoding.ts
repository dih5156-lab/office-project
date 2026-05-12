/**
 * multer가 한글 파일명을 Latin-1로 잘못 디코딩한 경우
 * UTF-8 바이트를 복원하여 올바른 한국어 문자열을 반환합니다.
 */
export function fixMojibake(str: string): string {
  if (!str) return str;
  // 이미 한글이 포함되어 있으면 그대로 반환
  if (/[\uAC00-\uD7A3\u3131-\u3163]/.test(str)) return str;
  try {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i) & 0xff;
    }
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    // 복원된 문자열에 한글이 포함되어 있으면 사용
    if (/[\uAC00-\uD7A3\u3131-\u3163]/.test(decoded)) return decoded;
  } catch {
    // valid UTF-8가 아니면 원본 반환
  }
  return str;
}
