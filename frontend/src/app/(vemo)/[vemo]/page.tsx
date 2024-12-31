'use client';

import React, { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import styles from './Vemo.module.css';
import SideBarNav from './components/sideBarNav/sideBarNav';

import { SummaryProvider } from '../[vemo]/context/SummaryContext';

// CKEditor 동적 로드
const EditorNoSSR = dynamic(() => import('./components/editor'), {
    ssr: false,
    loading: () => <p>Loading editor...</p>,
});

export default function VemoPage() {
    const playerRef = useRef<any>(null); // YouTube 플레이어 참조
    const editorRef = useRef<any>(null); // CKEditor 참조

    const [selectedOption, setSelectedOption] = useState('내 메모 보기');
    const [currentTimestamp, setCurrentTimestamp] = useState('00:00');

    // YouTube Iframe API 로드
    useEffect(() => {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);

        (window as any).onYouTubeIframeAPIReady = () => {
            playerRef.current = new (window as any).YT.Player('youtube-player', {
                videoId: 'pEt89CrE-6A',
                events: {
                    onReady: () => console.log('Player ready'),
                },
            });
        };
    }, []);

    // 현재 YouTube 재생 시간 갱신
    useEffect(() => {
        const interval = setInterval(() => {
            if (playerRef.current?.getCurrentTime) {
                const sec = playerRef.current.getCurrentTime();
                const mm = Math.floor(sec / 60);
                const ss = Math.floor(sec % 60);
                setCurrentTimestamp(
                    `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`,
                );
            }
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // 메시지 수신 처리 (캡처 관련)
    useEffect(() => {
        const handleMessage = (e: MessageEvent) => {
            if (e.data.type === 'CAPTURE_TAB_RESPONSE' || e.data.type === 'CAPTURE_AREA_RESPONSE') {
                if (editorRef.current?.addCaptureItem) {
                    editorRef.current.addCaptureItem(currentTimestamp, e.data.dataUrl);
                } else {
                    console.error('editorRef is not properly set.');
                }
            }
        };
        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [currentTimestamp]);

    // 전체 캡처
    const handleCaptureTab = () => {
        console.log('Capture Tab triggered');
        window.postMessage({ type: 'CAPTURE_TAB' }, '*');
    };

    // 부분 캡처
    const handleCaptureArea = () => {
        console.log('Capture Area triggered');
        window.postMessage({ type: 'CAPTURE_AREA' }, '*');
    };

    // 섹션 내용 렌더링
    const renderSectionContent = () => {
        switch (selectedOption) {
            case '내 메모 보기':
                return (
                    <>
                        <p className={styles.noteTitle}>내 메모 내용을 여기에 표시</p>
                        {/* <EditorNoSSR
                            ref={editorRef}
                            getTimestamp={() => currentTimestamp}
                            onTimestampClick={timestamp => {
                                const [m, s] = timestamp.split(':').map(Number);
                                const total = (m || 0) * 60 + (s || 0);
                                playerRef.current?.seekTo(total, true);
                            }}
                            isEditable={true}
                        /> */}
                    </>
                );
            default:
                return <p className={styles.noteTitle}>기본 내용을 여기에 표시</p>;
        }
    };

    return (
        <div className={styles.container}>
            {/* YouTube 섹션 */}
            <div className={styles.section1}>
                <Link href="/" passHref>
                    <img
                        src="/icons/Button_home.svg"
                        alt="VEMO logo"
                        className={styles.logoButton}
                    />
                </Link>
                <div className={styles.videoWrapper}>
                    <iframe
                        id="youtube-player"
                        src="https://www.youtube.com/embed/pEt89CrE-6A?enablejsapi=1"
                        title="YouTube Video Player"
                        frameBorder="0"
                        allowFullScreen
                    />
                </div>
            </div>

            {/* Sidebar */}
            <div className={styles.section3}>
                <SummaryProvider>
                    <SideBarNav
                        selectedOption={selectedOption}
                        onOptionSelect={setSelectedOption}
                        renderSectionContent={renderSectionContent}
                        currentTimestamp={currentTimestamp}
                        handleCaptureTab={handleCaptureTab}
                        handleCaptureArea={handleCaptureArea}
                        editorRef={editorRef}
                    />
                </SummaryProvider>
            </div>
        </div>
    );
}
