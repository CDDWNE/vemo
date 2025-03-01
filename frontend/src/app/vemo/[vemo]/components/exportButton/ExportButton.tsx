'use client';
import styles from '../sideBarNav/sideBarNav.module.css';
import Image from 'next/image';
import { useState } from 'react';

export default function ExportButton({ memosId }: { memosId: number }) {
    const [isExporting, setIsExporting] = useState(false);

    const handleDownloadPDF = async () => {
        try {
            setIsExporting(true);
            console.log('PDF 다운로드 요청 시작:', memosId);

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_BASE_URL}/pdf/download/${memosId}`,
                {
                    method: 'GET',
                    headers: {
                        Accept: 'application/pdf',
                    },
                },
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('서버 에러:', {
                    status: response.status,
                    text: errorText,
                });
                throw new Error(`서버 에러: ${response.status}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vemo_${memosId}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);

            console.log('PDF 다운로드 완료');
        } catch (error) {
            console.error('PDF 다운로드 실패:', error);
            alert('PDF 다운로드에 실패했습니다.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <button
            onClick={handleDownloadPDF}
            className={styles.iconButton}
            disabled={isExporting}
        >
            <Image
                className={styles.defaultIcon}
                src="/icons/bt_edit_nav_export.svg"
                alt="내보내기"
                width={20}
                height={20}
            />
            <span className={styles.iconButtonText}>
                {isExporting ? 'PDF 작성중...' : '내보내기'}
            </span>
        </button>
    );
}
