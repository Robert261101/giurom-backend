import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UsersService } from './users.service';

@Controller()
export class UsersMicroController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern({ cmd: 'employees.profile_picture_updated' })
  async handleProfilePictureUpdated(@Payload() data: { employee_id: number; profile_picture_url: string }) {
    console.log(`📥 Received profile picture update message for employee ${data.employee_id}: ${data.profile_picture_url}`);
    
    try {
      // Update the user's profile image in the auth database
      const updatedUser = await this.usersService.updateProfileImage(data.employee_id, data.profile_picture_url);
      console.log(`✅ Successfully updated profile image for user with employee_id ${data.employee_id}`);
      return updatedUser;
    } catch (error) {
      console.error(`❌ Error updating profile image for employee ${data.employee_id}:`, error);
      throw error;
    }
  }
}