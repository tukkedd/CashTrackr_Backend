import { type Request, type Response } from "express";
import User from "../models/User";
import { checkPassword, hashPassword } from "../utils/auth";
import { generateToken } from "../utils/token";
import { AuthEmail } from "../emails/AuthEmails";
import { generateJWT } from "../utils/jwt";

export class AuthController {

    static createAccount = async (req: Request, res: Response) => {


        const { email, password } = req.body

            // Prevenir duplicados ->

        const userExists = await User.findOne({where: {email}})
        if(userExists) {
            const error = new Error('Un usuario con ese email ya esta registrado')
            return res.status(409).json({error: error.message})
        }
        

        try {
            const user = new User(req.body)
            user.password = await hashPassword(password)
            user.token = generateToken()
            await user.save()

            await AuthEmail.sendConfirmationEmail({
                name: user.name,
                email: user.email,
                token: user.token
            })

            res.json('Cuenta Creada correctamente')
        } catch (error) {
            // console.log(error);
            res.status(500).json({error: 'Hubo un error'})
            
        }
    }

    static confirmAccount = async (req: Request, res: Response) => {
        const { token } = req.body
        
        const user = await User.findOne({where: { token }})
        if(!user) {
            const error = new Error('Token no valido')
            return res.status(401).json({error: error.message})
        }
        user.confirmed = true
        user.token = null
        await user.save()

        res.json('Cuenta confirmada correctamente')

        res.json(user)
        
    }

    static login = async (req: Request, res: Response) => {
        const { email, password } = req.body

        //Revisar si el usuario existe
        const user = await User.findOne({where: { email }})
        if(!user) {
            const error = new Error('usuario no registrado')
            return res.status(404).json({error: error.message})
        }

        if(!user.confirmed) {
            const error = new Error('Tu cuenta no ha sido confirmada')
            return res.status(403).json({error: error.message})
        }

        const isPasswordCorrect = await checkPassword(password, user.password)
        if(!isPasswordCorrect) {
            const error = new Error('El password es incorrecto')
            return res.status(401).json({error: error.message})
        }
        const token = generateJWT(user.id)

        res.json(token)

    }
    static forgotPassword = async (req: Request, res: Response) => {
        const { email } = req.body

        //Revisar si el usuario existe
        const user = await User.findOne({where: { email }})
        if(!user) {
            const error = new Error('usuario no Encontrado')
            return res.status(404).json({error: error.message})
        }
        user.token = generateToken()
        await user.save()

        await AuthEmail.sendPasswordResetToken({
            name: user.name,
            email: user.email,
            token: user.token
        })
        res.json('Hemos enviado un email con las instrucciones')
    }

    static validateToken = async (req: Request, res: Response) => {
        const { token } = req.body
        const tokenExists = await User.findOne({where: { token }})
        if(!tokenExists) {
            const error = new Error('Token no valido')
            return res.status(404).json({error: error.message})
        }

        res.json('Token valido')
    }

    static resetPasswordWithToken = async (req: Request, res: Response) => {
        const { token } = req.params
        const { password } = req.body

        const user = await User.findOne({where: { token }})
        if(!user) {
            const error = new Error('Token no valido')
            return res.status(404).json({error: error.message})
        }
        
        //asignar el nuevo password
        user.password = await hashPassword(password)
        user.token = null
        await user.save()

        res.json('Password modificado correctamente')
    }
    static user = async (req: Request, res: Response) => {
        res.json(req.user)
    }
    static updateCurrentUserPassword = async (req: Request, res: Response) => {
        const { current_password, password } = req.body
        const { id } = req.user
        const user = await User.findByPk(id)

        const isPasswordCorrect = await checkPassword(current_password, user.password)
        if(!isPasswordCorrect) {
            const error = new Error('El password actual es incorrecto')
            return res.status(401).json({error: error.message})
        }

        user.password = await hashPassword(password)
        await user.save()
        res.json('Password actualizado correctamente')
    }

    static checkPassword = async (req: Request, res: Response) => {
        const { password } = req.body
        const { id } = req.user

        const user = await User.findByPk(id)

        const isPasswordCorrect = await checkPassword(password, user.password)
        if(!isPasswordCorrect) {
            const error = new Error('El password actual es incorrecto')
            return res.status(401).json({error: error.message})
        }

        res.json('Password Correcto')
    }
}