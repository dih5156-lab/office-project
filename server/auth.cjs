const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'office_jwt_secret_2026';
const JWT_EXPIRES = '7d';

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, department: user.department },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  // 쿼리 파라미터로도 토큰 허용 (이미지 태그 등에서 사용)
  const queryToken = req.query?.token;
  const raw = header?.startsWith('Bearer ') ? header.slice(7) : queryToken;
  if (!raw) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }
  try {
    req.user = verifyToken(raw);
    next();
  } catch {
    res.status(401).json({ error: '토큰이 만료되었거나 유효하지 않습니다.' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
  next();
}

module.exports = { signToken, verifyToken, authMiddleware, adminOnly };
