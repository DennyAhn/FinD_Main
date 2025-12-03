import { Request, Response } from 'express';
import { userService } from './user.service';
import { UserParams, CreateUserDto, UpdateUserDto } from './user.types';

export class UserController {
  /**
   * GET /api/users/:id
   */
  async getUser(
    req: Request<UserParams>,
    res: Response
  ): Promise<void> {
    const { id } = req.params;
    const user = await userService.getUserById(id);
    res.status(200).json({ success: true, data: user });
  }

  /**
   * POST /api/users
   */
  async createUser(
    req: Request<unknown, unknown, CreateUserDto>,
    res: Response
  ): Promise<void> {
    const user = await userService.createUser(req.body);
    res.status(201).json({ success: true, data: user });
  }

  /**
   * PATCH /api/users/:id
   */
  async updateUser(
    req: Request<UserParams, unknown, UpdateUserDto>,
    res: Response
  ): Promise<void> {
    const { id } = req.params;
    const user = await userService.updateUser(id, req.body);
    res.status(200).json({ success: true, data: user });
  }

  /**
   * DELETE /api/users/:id
   */
  async deleteUser(
    req: Request<UserParams>,
    res: Response
  ): Promise<void> {
    const { id } = req.params;
    await userService.deleteUser(id);
    res.status(204).send();
  }
}

export const userController = new UserController();
