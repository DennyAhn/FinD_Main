import { Request, Response } from 'express';
import { alertService } from './alert.service';
import { AlertParams, AlertQuery, CreateAlertDto, UpdateAlertDto } from './alert.types';

export class AlertController {
  /**
   * GET /api/alerts
   */
  async getAlerts(
    req: Request<unknown, unknown, unknown, AlertQuery>,
    res: Response
  ): Promise<void> {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      res.status(401).json({ success: false, error: '인증이 필요합니다.' });
      return;
    }

    const alerts = await alertService.getAlerts(userId, {
      ...(req.query.symbol && { symbol: req.query.symbol }),
      ...(req.query.status && { status: req.query.status }),
    });

    res.status(200).json({ success: true, data: alerts });
  }

  /**
   * GET /api/alerts/:id
   */
  async getAlert(
    req: Request<AlertParams>,
    res: Response
  ): Promise<void> {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      res.status(401).json({ success: false, error: '인증이 필요합니다.' });
      return;
    }

    const alert = await alertService.getAlertById(userId, req.params.id);
    res.status(200).json({ success: true, data: alert });
  }

  /**
   * POST /api/alerts
   */
  async createAlert(
    req: Request<unknown, unknown, CreateAlertDto>,
    res: Response
  ): Promise<void> {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      res.status(401).json({ success: false, error: '인증이 필요합니다.' });
      return;
    }

    const alert = await alertService.createAlert(userId, req.body);
    res.status(201).json({ success: true, data: alert });
  }

  /**
   * PATCH /api/alerts/:id
   */
  async updateAlert(
    req: Request<AlertParams, unknown, UpdateAlertDto>,
    res: Response
  ): Promise<void> {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      res.status(401).json({ success: false, error: '인증이 필요합니다.' });
      return;
    }

    const alert = await alertService.updateAlert(userId, req.params.id, req.body);
    res.status(200).json({ success: true, data: alert });
  }

  /**
   * DELETE /api/alerts/:id
   */
  async deleteAlert(
    req: Request<AlertParams>,
    res: Response
  ): Promise<void> {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      res.status(401).json({ success: false, error: '인증이 필요합니다.' });
      return;
    }

    await alertService.deleteAlert(userId, req.params.id);
    res.status(204).send();
  }
}

export const alertController = new AlertController();
