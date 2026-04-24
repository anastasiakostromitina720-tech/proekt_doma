import { Injectable } from '@nestjs/common';
import type {
  CreateProjectInput,
  ListProjectsQuery,
  Project,
  ProjectsListResponse,
  UpdateProjectInput,
} from '@app/contracts';

import { toProjectDto } from './projects.mapper';
import { ProjectsRepository } from './projects.repository';

/**
 * Projects service — a thin application layer on top of
 * `ProjectsRepository`. All ownership / race-safety concerns live in the
 * repository; this class only handles DTO mapping and input shaping.
 */
@Injectable()
export class ProjectsService {
  constructor(private readonly repository: ProjectsRepository) {}

  async list(userId: string, query: ListProjectsQuery): Promise<ProjectsListResponse> {
    const [items, total] = await this.repository.findManyForUser(userId, query);
    return {
      items: items.map(toProjectDto),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async findOne(userId: string, id: string): Promise<Project> {
    const project = await this.repository.findOneOwned(userId, id);
    return toProjectDto(project);
  }

  async create(userId: string, input: CreateProjectInput): Promise<Project> {
    const created = await this.repository.createForUser(userId, input);
    return toProjectDto(created);
  }

  async update(userId: string, id: string, input: UpdateProjectInput): Promise<Project> {
    const updated = await this.repository.updateOwned(userId, id, input);
    return toProjectDto(updated);
  }

  remove(userId: string, id: string): Promise<void> {
    return this.repository.deleteOwned(userId, id);
  }
}
