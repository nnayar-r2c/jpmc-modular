import path from 'path';
import { NextFunction, Request, Response } from 'express';

export default function createRedirectServedPathMiddleware(servedPath: string) {
  // remove end slash so user can land on `/test` instead of `/test/`
  servedPath = servedPath.slice(0, -1);
  return function redirectServedPathMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    if (
      servedPath === '' ||
      req.url === servedPath ||
      req.url.startsWith(servedPath)
    ) {
      next();
    } else {
      const newPath = path.join(servedPath, req.path !== '/' ? req.path : '');
      res.redirect(newPath);
    }
  };
}
