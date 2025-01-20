import {
    Inject,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { S3 } from 'aws-sdk';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Memos } from '../memos/memos.entity';
import { Captures } from './captures.entity';
import { CreateCapturesDto } from './dto/create-capture.dto';
import { UpdateCapturesDto } from './dto/update-capture.dto';
// import { CACHE_MANAGER } from '@nestjs/cache-manager';
// import { Cache } from 'cache-manager';

@Injectable()
export class CapturesService {
    private readonly bucketName: string;
    private readonly logger = new Logger(CapturesService.name);

    constructor(
        @InjectRepository(Memos) private readonly memosRepository: Repository<Memos>,
        @InjectRepository(Captures) private capturesRepository: Repository<Captures>,
        @Inject('S3') private readonly s3: S3,
        // @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly configService: ConfigService,
    ) {
        this.bucketName = this.configService.get<string>('AWS_S3_BUCKET');
    }

    async createCapture(createCapturesDto: CreateCapturesDto, isScrap = false): Promise<Captures> {
        try {
            const { memosId, image, ...rest } = createCapturesDto;
            const memos = await this.memosRepository.findOne({
                where: { id: memosId },
            });

            const captures = this.capturesRepository.create({
                ...rest,
                memos,
            });

            if (!isScrap) {
                const uploadUrl = await this.uploadBase64ToS3(createCapturesDto.image, 'captures');
                this.logger.log('uploadUrl', uploadUrl);
                captures.image = uploadUrl;
            } else {
                captures.image = image;
            }

            const savedCapture = await this.capturesRepository.save(captures);
            // await this.invalidateCache();
            return savedCapture;
        } catch (error) {
            throw new InternalServerErrorException('Failed to create capture', {
                cause: error,
            });
        }
    }

    async getCaptures(): Promise<Captures[]> {
        try {
            // const cacheKey = 'captures:all';
            // const cachedCaptures = await this.cacheManager.get<Captures[]>(cacheKey);

            // if (cachedCaptures) {
            //     this.logger.log('Cache HIT for all captures');
            //     return cachedCaptures;
            // }

            this.logger.log('Cache MISS for all captures');
            const captures = await this.capturesRepository.find({
                relations: ['memos'],
                order: {
                    timestamp: 'ASC',
                },
            });

            // await this.cacheManager.set(cacheKey, captures, 3600);
            return captures;
        } catch (error) {
            throw new InternalServerErrorException('Failed to get captures', {
                cause: error,
            });
        }
    }

    async getCaptureById(id: number): Promise<Captures> {
        try {
            // const cacheKey = `capture:${id}`;
            // const cachedCapture = await this.cacheManager.get<Captures>(cacheKey);

            // if (cachedCapture) {
            //     this.logger.log(`Cache HIT for capture ${id}`);
            //     return cachedCapture;
            // }

            this.logger.log(`Cache MISS for capture ${id}`);
            const capture = await this.capturesRepository.findOne({
                where: { id },
                relations: ['memos'],
            });

            if (!capture) {
                throw new NotFoundException(`Capture with ID ${id} not found`);
            }

            // await this.cacheManager.set(cacheKey, capture, 3600);
            return capture;
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to get capture', {
                cause: error,
            });
        }
    }

    async updateCapture(id: number, updateCapturesDto: UpdateCapturesDto): Promise<Captures> {
        try {
            const capture = await this.capturesRepository.findOne({
                where: { id },
                relations: ['memos'],
            });

            if (!capture) {
                throw new NotFoundException(`Capture with ID ${id} not found`);
            }

            if (updateCapturesDto.image) {
                const uploadUrl = await this.uploadBase64ToS3(updateCapturesDto.image, 'captures');
                capture.image = uploadUrl;
            }

            const updatedCapture = await this.capturesRepository.save(capture);
            // await this.invalidateCache(id);
            return updatedCapture;
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to update capture', {
                cause: error,
            });
        }
    }

    async deleteCapture(id: number): Promise<void> {
        const capture = await this.capturesRepository.findOne({ where: { id } });
        if (!capture) {
            throw new NotFoundException('Capture not found', {
                cause: 'Capture not found',
            });
        }

        await this.capturesRepository.delete(id);
        // await this.invalidateCache(id);
    }

    // private async invalidateCache(id?: number): Promise<void> {
    //     const promises = ['captures:all'];
    //     if (id) {
    //         promises.push(`capture:${id}`);
    //     }
    //     await Promise.all(promises.map(key => this.cacheManager.del(key)));
    //     this.logger.log('Cache invalidated');
    // }

    async uploadBase64ToS3(base64: string, folder: string): Promise<string> {
        try {
            const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const ext = base64.match(/data:image\/(\w+);base64/)?.[1] || 'png';
            const fileName = `${folder}/${uuidv4()}.${ext}`;

            const uploadResult = await this.s3
                .upload({
                    Bucket: 'vemo-data-bucket',
                    Key: fileName,
                    Body: buffer,
                    ContentEncoding: 'base64',
                    ContentType: `image/${ext}`,
                })
                .promise();

            return uploadResult.Location;
        } catch (error) {
            throw new InternalServerErrorException('S3 업로드에 실패했습니다.', {
                cause: error,
            });
        }
    }
}
