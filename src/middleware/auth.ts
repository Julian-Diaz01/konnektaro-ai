import { Request, Response, NextFunction } from 'express'
import admin from '../config/firebase'

// Extend Express to include user
declare global {
    namespace Express {
        interface Request {
            user?: {
                uid: string
                email?: string
                name?: string
                isAnonymous?: boolean
            }
        }
    }
}

export const verifyFirebaseToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing token' })
        return
    }

    const token = authHeader.split(' ')[1]

    try {
        const decodedToken = await admin.auth().verifyIdToken(token)

        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name,
            isAnonymous: decodedToken.firebase?.sign_in_provider === 'anonymous'
        }

        next()
    } catch (err) {
        res.status(403).json({ error: 'Invalid or expired token' })
        return
    }
}
export const requireNonAnonymous = (req: Request, res: Response, next: NextFunction): void => {
    if (req.user?.isAnonymous) {
        res.status(403).json({ error: 'Anonymous access is not allowed for this route' })
        return
    }
    next()
}