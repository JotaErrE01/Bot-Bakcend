import { Request, Response } from "express";
import cron from 'node-cron';


export const deleteCronTask = async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    console.log({ taskId });
    
    if (!taskId) return res.status(400).json({ msg: 'No se envió el id de la tarea' });

    const task = cron.getTasks().get(taskId);

    console.log({ task });
    

    if (!task) return res.status(200).json({ msg: 'No se encontró la tarea' });

    task.stop();

    return res.status(200).json({ msg: 'Tarea eliminada' });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ msg: 'Error en el servidor' });
  }
}
