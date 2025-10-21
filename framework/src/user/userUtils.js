import { userComponent } from "../ecs/components/index.js"

export function getById(userId,world){
    let usersEID = world.query([userComponent]);

    for (const userEID of usersEID){
        let user = world.getComponent(userEID,userComponent)

        if (user.id == userId){
            return user;
        }
    }
    return null;
}