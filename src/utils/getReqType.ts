import { IReqType } from '../interfaces/IReqType';

export const getReqType = (req: IReqType): 'template' | 'message' => {
  if(req.entry[0].changes[0].field === 'message_template_status_update'){
    return 'template';
  }else {
    return 'message';
  }
}