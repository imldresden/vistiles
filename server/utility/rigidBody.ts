/**
 * Created by horak on 09.02.16.
 */

export class RigidBody {
  id: string;
  pos: number[];
  orientation: number[];
  name: string;
  timeStamp: number;

  constructor(id: string, position: number[], orientation: number[], name: string, timeTag: any) {
    this.id = id;
    this.pos = position;
    this.orientation = orientation;
    this.name = name;
    this.timeStamp = timeTag.raw[1] + timeTag.native;
  }
}

export default RigidBody;