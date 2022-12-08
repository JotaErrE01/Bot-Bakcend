import { Router } from 'express';
import { MetaApi } from '../api';
import { messages } from '../controllers';

const router = Router();

router.get('/', (req, res) => {
  res.send('Hello World!');
})

// validar token con meta
router.get( '/:webHookApi', messages.validarWebHookToken);

router.post( '/sendMessage', messages.sendMessage);

// controllar envios de mesnajes y responderlos
router.post( '/:webHookApi', messages.messagesController );

router.post( '/send', async (req, res) => {
  try {
    const botMessageData = {
      "messaging_product": "whatsapp",
      "to": `${593968806155}`,
      "type": "template",
      "template": {
        "name": "hello_world",
        "language": { "code": "en_US" }
      },
    };
    // TODO: GET APP TOKEN FROM DATABASE
    const metaApi = MetaApi.createApi('s');
    const { data } = await metaApi.post(`/${104148912327082}/messages`, botMessageData);
    console.log(data);

    return res.status(200).json({ msg: 'Mensaje enviado' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: 'Error en el servidor' });
  }
  
} );

export default router;
