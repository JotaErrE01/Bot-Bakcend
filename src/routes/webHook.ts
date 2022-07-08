import { Router } from 'express';
import { messages } from '../controllers';

const router = Router();

router.get('/', (req, res) => {
  res.send('Hello World!');
})

// validar token con meta
router.get( '/webhook', messages.validarWebHookToken);

// controllar envios de mesnajes y responderlos
router.post( '/webhook', messages.messagesController );

export default router;
